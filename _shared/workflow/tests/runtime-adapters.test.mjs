import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  normalizeDecisionJson,
  normalizeRuntimeWorkflowInput,
  resolveClaudeWorkflow,
  resolveCodexWorkflow,
  resolveRuntimeWorkflow,
} from "../src/runtime-adapters.mjs";

const FIXTURES = JSON.parse(
  fs.readFileSync(path.join(import.meta.dir, "..", "fixtures", "runtime-parity.json"), "utf8"),
);

function expectDecision(decision, expected) {
  expect(decision).toMatchObject(expected);
  expect(decision.enabledCapabilities).toContain("verification");
  expect(decision.configurationSources.length).toBeGreaterThan(0);
}

describe("cross-runtime workflow adapters", () => {
  for (const fixture of FIXTURES.decisions) {
    test(`normalizes ${fixture.id} to identical decision JSON (AC-045)`, () => {
      const claudeInput = normalizeRuntimeWorkflowInput("claude-code", fixture.claude);
      const codexInput = normalizeRuntimeWorkflowInput("codex", fixture.codex);

      expect(claudeInput).toEqual(codexInput);

      const claude = resolveClaudeWorkflow(fixture.claude);
      const codex = resolveCodexWorkflow(fixture.codex);

      expect(claude.source).toBe("explicit-skill");
      expect(codex.source).toBe("explicit-skill");
      expectDecision(claude.decision, fixture.expected);
      expect(claude.decision).toEqual(codex.decision);
      expect(normalizeDecisionJson(claude)).toBe(normalizeDecisionJson(codex));
    });
  }

  test("uses one explicit skill resolution when a Claude hook is missing (AC-046)", () => {
    const fixture = FIXTURES.decisions[1];
    let explicitCalls = 0;
    const result = resolveClaudeWorkflow(fixture.claude, {
      resolveExplicit(input) {
        explicitCalls += 1;
        return resolveRuntimeWorkflow("claude-code", input);
      },
    });

    expect(explicitCalls).toBe(1);
    expect(result.source).toBe("explicit-skill");
    expect(result.fallbackReason).toBe("hook-missing");
    expect(result.decision).toEqual(resolveCodexWorkflow(fixture.codex).decision);
  });

  test("uses the same explicit decision after a throwing Claude hook (AC-046)", () => {
    const fixture = FIXTURES.decisions[2];
    let explicitCalls = 0;
    const result = resolveClaudeWorkflow(fixture.claude, {
      resolveHook() {
        throw new Error("hook unavailable");
      },
      resolveExplicit(input) {
        explicitCalls += 1;
        return resolveRuntimeWorkflow("claude-code", input);
      },
    });

    expect(explicitCalls).toBe(1);
    expect(result.fallbackReason).toBe("hook-failed");
    expect(result.decision).toEqual(resolveCodexWorkflow(fixture.codex).decision);
  });

  test("rejects invalid hook output and falls back without importing Warden (AC-046, AC-047)", () => {
    const fixture = FIXTURES.decisions[0];
    const result = resolveClaudeWorkflow(fixture.claude, {
      resolveHook: () => ({ workflow: "project-creation", effectiveProfile: "turbo" }),
    });

    expect(result.fallbackReason).toBe("hook-invalid");
    expect(result.decision).toEqual(resolveCodexWorkflow(fixture.codex).decision);

    const source = fs.readFileSync(
      path.join(import.meta.dir, "..", "src", "runtime-adapters.mjs"),
      "utf8",
    );
    expect(source).not.toContain("warden/");
    expect(source).not.toContain("_shared/");
  });

  test("rejects a structurally valid hook decision that disagrees with canonical policy", () => {
    const fixture = FIXTURES.decisions[2];
    const canonicalDecision = resolveRuntimeWorkflow("claude-code", fixture.claude);
    const staleHookDecision = {
      ...canonicalDecision,
      riskFloor: "quick",
      effectiveProfile: "quick",
      normalizedEvidence: [],
      activeRisks: [],
      escalations: [],
      enabledCapabilities: [],
      resolvedCapabilities: [],
      diagnostics: [],
    };
    let explicitCalls = 0;
    const result = resolveClaudeWorkflow(fixture.claude, {
      resolveHook: () => staleHookDecision,
      resolveExplicit(input) {
        explicitCalls += 1;
        return resolveRuntimeWorkflow("claude-code", input);
      },
    });

    expect(explicitCalls).toBe(1);
    expect(result).toEqual({
      decision: canonicalDecision,
      source: "explicit-skill",
      fallbackReason: "hook-policy-mismatch",
    });
    expect(result.decision.effectiveProfile).toBe("strict");
    expect(result.decision.enabledCapabilities).toContain("verification");
  });

  test("accepts a valid hook decision after validating it against canonical policy", () => {
    const fixture = FIXTURES.decisions[1];
    const hookDecision = resolveRuntimeWorkflow("claude-code", fixture.claude);
    let explicitCalls = 0;
    const result = resolveClaudeWorkflow(fixture.claude, {
      resolveHook: () => hookDecision,
      resolveExplicit(input) {
        explicitCalls += 1;
        return resolveRuntimeWorkflow("claude-code", input);
      },
    });

    expect(explicitCalls).toBe(1);
    expect(result).toEqual({
      decision: hookDecision,
      source: "hook",
      fallbackReason: null,
    });
  });

  test("forwards Claude and Codex project roots into repository configuration resolution", () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-runtime-adapter-"));
    const configurationDirectory = path.join(projectRoot, ".nuthouse");
    fs.mkdirSync(configurationDirectory);
    fs.writeFileSync(
      path.join(configurationDirectory, "workflow.json"),
      JSON.stringify({ schemaVersion: 1, defaultProfile: "strict" }),
    );

    try {
      const fixture = FIXTURES.decisions[1];
      const claudeInput = {
        ...fixture.claude,
        configuration: { projectRoot },
      };
      const codexInput = {
        ...fixture.codex,
        configuration: { project_root: projectRoot },
      };

      expect(normalizeRuntimeWorkflowInput("claude-code", claudeInput).configuration).toEqual({
        projectRoot,
      });
      expect(normalizeRuntimeWorkflowInput("codex", codexInput).configuration).toEqual({
        projectRoot,
      });

      const claude = resolveClaudeWorkflow(claudeInput);
      const codex = resolveCodexWorkflow(codexInput);
      const repositoryPath = path.join(configurationDirectory, "workflow.json");

      expect(claude.decision).toEqual(codex.decision);
      expect(claude.decision.requestedProfile).toBe("strict");
      expect(claude.decision.effectiveProfile).toBe("strict");
      expect(claude.decision.configurationSources).toContainEqual({
        source: "repository",
        profile: "strict",
        path: repositoryPath,
      });
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
