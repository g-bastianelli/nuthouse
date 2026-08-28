import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "bun:test";

import { discoverGitContext, getWorktreeOverridePath } from "../lib/workflow/index.mjs";
import {
  getDefaultPersonalConfigPath,
  normalizeModeInput,
  runMode,
  WORKTREE_OVERRIDE_DURATION_MS,
} from "../scripts/mode.mjs";

const MODE_SCRIPT = path.resolve(import.meta.dir, "..", "scripts", "mode.mjs");
const STATUS_FIELDS = [
  "requestedProfile",
  "effectiveProfile",
  "configurationSources",
  "escalations",
  "enabledCapabilities",
  "diagnostics",
  "blocked",
];
const temporaryDirectories = new Set();

afterEach(() => {
  for (const directory of temporaryDirectories) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
  temporaryDirectories.clear();
});

function git(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }

  return result.stdout.trim();
}

function makeRepository({ sibling = false } = {}) {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "warden-mode-"));
  temporaryDirectories.add(fixture);
  const primary = path.join(fixture, "primary");
  const homeDirectory = path.join(fixture, "home");
  fs.mkdirSync(primary, { recursive: true });
  fs.mkdirSync(homeDirectory, { recursive: true });

  git(primary, ["init", "-b", "main"]);
  git(primary, ["config", "user.email", "warden-mode@example.test"]);
  git(primary, ["config", "user.name", "Warden Mode Test"]);
  fs.writeFileSync(path.join(primary, "README.md"), "fixture\n");
  git(primary, ["add", "README.md"]);
  git(primary, ["commit", "-m", "fixture"]);

  let siblingPath;
  if (sibling) {
    siblingPath = path.join(fixture, "sibling");
    git(primary, ["worktree", "add", "-b", "sibling", siblingPath]);
  }

  return { fixture, primary, sibling: siblingPath, homeDirectory };
}

function writeConfig(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function repositoryConfigPath(repository) {
  return path.join(repository, ".nuthouse", "workflow.json");
}

function optionsFor(repository, homeDirectory, now) {
  return { cwd: repository, homeDirectory, now };
}

function blockingDiagnostic(result) {
  expect(result.status.blocked).toBe(true);
  expect(result.status.diagnostics).toHaveLength(1);
  return result.status.diagnostics[0];
}

describe("warden mode adapter", () => {
  test("returns the complete status projection with an injected personal path (AC-011)", async () => {
    const repo = makeRepository();
    const personalPath = getDefaultPersonalConfigPath(repo.homeDirectory);
    writeConfig(personalPath, { schemaVersion: 1, defaultProfile: "quick" });

    const result = await runMode(
      "status",
      optionsFor(repo.primary, repo.homeDirectory, "2026-08-28T08:00:00.000Z"),
    );

    expect(result.action).toBe("status");
    expect(result.override).toBeNull();
    expect(Object.keys(result.status)).toEqual(STATUS_FIELDS);
    expect(result.status.requestedProfile).toBe("quick");
    expect(result.status.effectiveProfile).toBe("quick");
    expect(result.status.configurationSources.length).toBeGreaterThan(0);
    expect(result.status.escalations).toEqual([]);
    expect(result.status.enabledCapabilities).toEqual([]);
    expect(result.status.blocked).toBe(false);
  });

  test("persists each profile for exactly 24 hours and expires at the boundary (AC-008)", async () => {
    const repo = makeRepository();
    const createdAt = new Date("2026-08-28T09:10:11.000Z");
    const justBeforeExpiry = new Date(createdAt.getTime() + WORKTREE_OVERRIDE_DURATION_MS - 1);
    const exactExpiry = new Date(createdAt.getTime() + WORKTREE_OVERRIDE_DURATION_MS);
    const context = discoverGitContext(repo.primary);
    const overridePath = getWorktreeOverridePath(context);

    let setResult;
    for (const profile of ["standard", "strict", "quick"]) {
      setResult = await runMode(profile, optionsFor(repo.primary, repo.homeDirectory, createdAt));
      expect(setResult.action).toBe(profile);
      expect(setResult.status.requestedProfile).toBe(profile);
      expect(setResult.status.effectiveProfile).toBe(profile);
      expect(setResult.override.profile).toBe(profile);
    }

    expect(setResult.status.requestedProfile).toBe("quick");
    expect(setResult.status.effectiveProfile).toBe("quick");
    expect(setResult.override).toEqual({
      path: overridePath,
      profile: "quick",
      expiresAt: exactExpiry.toISOString(),
    });
    expect(setResult.status.configurationSources).toContainEqual({
      source: "worktree",
      profile: "quick",
      path: overridePath,
    });
    expect(fs.existsSync(overridePath)).toBe(true);

    const before = await runMode(
      "status",
      optionsFor(repo.primary, repo.homeDirectory, justBeforeExpiry),
    );
    expect(before.status.requestedProfile).toBe("quick");
    expect(before.override).toEqual(setResult.override);
    expect(fs.existsSync(overridePath)).toBe(true);

    const expired = await runMode(
      "status",
      optionsFor(repo.primary, repo.homeDirectory, exactExpiry),
    );
    expect(expired.status.requestedProfile).toBe("standard");
    expect(expired.status.effectiveProfile).toBe("standard");
    expect(expired.override).toBeNull();
    expect(fs.existsSync(overridePath)).toBe(false);
  });

  test("isolates profile overrides and reset across real Git worktrees (AC-007, AC-012)", async () => {
    const repo = makeRepository({ sibling: true });
    const now = "2026-08-28T10:00:00.000Z";
    const primaryContext = discoverGitContext(repo.primary);
    const siblingContext = discoverGitContext(repo.sibling);
    const primaryOverridePath = getWorktreeOverridePath(primaryContext);
    const siblingOverridePath = getWorktreeOverridePath(siblingContext);
    const personalPath = getDefaultPersonalConfigPath(repo.homeDirectory);
    const repositoryPath = repositoryConfigPath(repo.primary);
    const voicePath = path.join(repo.homeDirectory, ".claude", "nuthouse", "voice.state");

    writeConfig(personalPath, { schemaVersion: 1, defaultProfile: "standard" });
    writeConfig(repositoryPath, { schemaVersion: 1, defaultProfile: "standard" });
    fs.mkdirSync(path.dirname(voicePath), { recursive: true });
    fs.writeFileSync(voicePath, "off\n");
    const personalBefore = fs.readFileSync(personalPath, "utf8");
    const repositoryBefore = fs.readFileSync(repositoryPath, "utf8");
    const voiceBefore = fs.readFileSync(voicePath, "utf8");

    await runMode("quick", optionsFor(repo.primary, repo.homeDirectory, now));
    const untouchedSibling = await runMode(
      "status",
      optionsFor(repo.sibling, repo.homeDirectory, now),
    );
    expect(untouchedSibling.status.requestedProfile).toBe("standard");

    await runMode("strict", optionsFor(repo.sibling, repo.homeDirectory, now));
    const reset = await runMode("reset", optionsFor(repo.primary, repo.homeDirectory, now));
    const siblingStatus = await runMode(
      "status",
      optionsFor(repo.sibling, repo.homeDirectory, now),
    );

    expect(primaryOverridePath).not.toBe(siblingOverridePath);
    expect(reset.override).toEqual({ path: primaryOverridePath, removed: true });
    expect(reset.status.requestedProfile).toBe("standard");
    expect(fs.existsSync(primaryOverridePath)).toBe(false);
    expect(fs.existsSync(siblingOverridePath)).toBe(true);
    expect(siblingStatus.status.requestedProfile).toBe("strict");
    expect(fs.readFileSync(personalPath, "utf8")).toBe(personalBefore);
    expect(fs.readFileSync(repositoryPath, "utf8")).toBe(repositoryBefore);
    expect(fs.readFileSync(voicePath, "utf8")).toBe(voiceBefore);
  });

  test("blocks invalid repository configuration before writes or expiry cleanup (AC-049)", async () => {
    const repo = makeRepository();
    const createdAt = new Date("2026-08-28T11:00:00.000Z");
    const expiredAt = new Date(createdAt.getTime() + WORKTREE_OVERRIDE_DURATION_MS);
    const context = discoverGitContext(repo.primary);
    const overridePath = getWorktreeOverridePath(context);

    await runMode("quick", optionsFor(repo.primary, repo.homeDirectory, createdAt));
    writeConfig(repositoryConfigPath(repo.primary), {
      schemaVersion: 1,
      defaultProfile: "turbo",
    });
    const overrideBefore = fs.readFileSync(overridePath, "utf8");

    const status = await runMode("status", optionsFor(repo.primary, repo.homeDirectory, expiredAt));
    const statusDiagnostic = blockingDiagnostic(status);
    expect(statusDiagnostic.source).toBe("repository");
    expect(statusDiagnostic.field).toBe("$.defaultProfile");
    expect(fs.readFileSync(overridePath, "utf8")).toBe(overrideBefore);

    const write = await runMode("strict", optionsFor(repo.primary, repo.homeDirectory, expiredAt));
    const writeDiagnostic = blockingDiagnostic(write);
    expect(writeDiagnostic.source).toBe("repository");
    expect(writeDiagnostic.field).toBe("$.defaultProfile");
    expect(write.override).toBeNull();
    expect(fs.readFileSync(overridePath, "utf8")).toBe(overrideBefore);
  });

  test("blocks reset before mutation when repository configuration is invalid (AC-049)", async () => {
    const repo = makeRepository({ sibling: true });
    const now = "2026-08-28T12:00:00.000Z";
    const primaryContext = discoverGitContext(repo.primary);
    const siblingContext = discoverGitContext(repo.sibling);
    const primaryOverridePath = getWorktreeOverridePath(primaryContext);
    const siblingOverridePath = getWorktreeOverridePath(siblingContext);

    await runMode("quick", optionsFor(repo.primary, repo.homeDirectory, now));
    await runMode("strict", optionsFor(repo.sibling, repo.homeDirectory, now));
    writeConfig(repositoryConfigPath(repo.primary), {
      schemaVersion: 1,
      defaultProfile: "turbo",
    });
    const repositoryBefore = fs.readFileSync(repositoryConfigPath(repo.primary), "utf8");
    const primaryBefore = fs.readFileSync(primaryOverridePath, "utf8");
    const siblingBefore = fs.readFileSync(siblingOverridePath, "utf8");

    const result = await runMode("reset", optionsFor(repo.primary, repo.homeDirectory, now));
    const diagnostic = blockingDiagnostic(result);

    expect(diagnostic.source).toBe("repository");
    expect(diagnostic.field).toBe("$.defaultProfile");
    expect(result.override).toBeNull();
    expect(fs.readFileSync(primaryOverridePath, "utf8")).toBe(primaryBefore);
    expect(fs.readFileSync(siblingOverridePath, "utf8")).toBe(siblingBefore);
    expect(fs.readFileSync(repositoryConfigPath(repo.primary), "utf8")).toBe(repositoryBefore);
  });

  test("reports invalid personal configuration and continues from core plus valid repo layers (AC-050)", async () => {
    const repo = makeRepository();
    const personalPath = getDefaultPersonalConfigPath(repo.homeDirectory);
    const now = "2026-08-28T13:00:00.000Z";
    writeConfig(personalPath, { schemaVersion: 1, defaultProfile: "turbo" });

    const coreFallback = await runMode("status", optionsFor(repo.primary, repo.homeDirectory, now));
    expect(coreFallback.status.requestedProfile).toBe("standard");
    expect(coreFallback.status.blocked).toBe(false);
    expect(coreFallback.status.configurationSources.map(({ source }) => source)).toEqual(["core"]);
    expect(coreFallback.status.diagnostics).toContainEqual(
      expect.objectContaining({ source: "personal", field: "$.defaultProfile" }),
    );

    writeConfig(repositoryConfigPath(repo.primary), {
      schemaVersion: 1,
      defaultProfile: "quick",
    });
    const repositoryWins = await runMode(
      "status",
      optionsFor(repo.primary, repo.homeDirectory, now),
    );
    expect(repositoryWins.status.requestedProfile).toBe("quick");
    expect(repositoryWins.status.blocked).toBe(false);
    expect(repositoryWins.status.configurationSources.map(({ source }) => source)).toEqual([
      "core",
      "repository",
    ]);
    expect(repositoryWins.status.diagnostics).toContainEqual(
      expect.objectContaining({ source: "personal", field: "$.defaultProfile" }),
    );
  });

  test("produces identical output from normalized Claude and Codex adapter inputs (AC-045)", async () => {
    const repo = makeRepository();
    const now = () => new Date("2026-08-28T14:00:00.000Z");
    writeConfig(repositoryConfigPath(repo.primary), {
      schemaVersion: 1,
      defaultProfile: "strict",
    });

    const claudeInput = normalizeModeInput({
      runtime: "claude",
      action: "status",
      cwd: repo.primary,
      homeDirectory: repo.homeDirectory,
      now,
    });
    const codexInput = normalizeModeInput("status", {
      runtime: "codex",
      cwd: repo.primary,
      homeDirectory: repo.homeDirectory,
      now,
    });

    const claude = await runMode(claudeInput);
    const codex = await runMode(codexInput);
    expect(claude).toEqual(codex);
  });

  test("prints JSON and exits nonzero for invalid actions and blocked configuration", () => {
    const repo = makeRepository();
    const env = { ...process.env, HOME: repo.homeDirectory };
    const invalidAction = spawnSync(process.execPath, [MODE_SCRIPT, "turbo"], {
      cwd: repo.primary,
      env,
      encoding: "utf8",
    });
    const invalidActionResult = JSON.parse(invalidAction.stdout);
    expect(invalidAction.status).not.toBe(0);
    expect(invalidActionResult.status.blocked).toBe(true);
    expect(invalidActionResult.status.diagnostics[0].field).toBe("$.action");

    writeConfig(repositoryConfigPath(repo.primary), {
      schemaVersion: 1,
      unexpected: true,
    });
    const blocked = spawnSync(process.execPath, [MODE_SCRIPT, "status"], {
      cwd: repo.primary,
      env,
      encoding: "utf8",
    });
    const blockedResult = JSON.parse(blocked.stdout);
    expect(blocked.status).not.toBe(0);
    expect(blockedResult.status.blocked).toBe(true);
    expect(blockedResult.status.diagnostics).toHaveLength(1);
    expect(blockedResult.status.diagnostics[0]).toEqual(
      expect.objectContaining({ source: "repository", field: "$.unexpected" }),
    );
  });

  test("imports only the Warden-local workflow bundle", () => {
    const source = fs.readFileSync(MODE_SCRIPT, "utf8");
    expect(source).toContain('from "../lib/workflow/index.mjs"');
    expect(source).not.toContain("_shared/workflow");
  });
});
