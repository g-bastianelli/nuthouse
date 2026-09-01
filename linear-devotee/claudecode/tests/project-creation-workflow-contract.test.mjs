import { afterEach, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  classifyWorkflow,
  consumeManifestHandoff,
  discoverGitContext,
  normalizeRuntimeWorkflowInput,
  resolveConfiguration,
  resolveWorkflowDecision,
  writeDecisionManifest,
} from "../../lib/workflow/index.mjs";

const REPO_ROOT = path.resolve(import.meta.dir, "..", "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

const createProject = read("linear-devotee/skills/create-project/SKILL.md");
const projectDrafter = read("linear-devotee/agents/project-drafter.md");
const projectGraphLoader = read("linear-devotee/agents/project-graph-loader.md");
const writeSpec = read("acid-prophet/skills/write-spec/SKILL.md");
const writePlan = read("acid-prophet/skills/write-plan/SKILL.md");
const createIssue = read("linear-devotee/skills/create-issue/SKILL.md");
const createMilestone = read("linear-devotee/skills/create-milestone/SKILL.md");
const NOW = new Date("2026-08-31T12:00:00.000Z");
const EXPIRES_AT = new Date("2026-09-01T12:00:00.000Z").toISOString();
const POLICY_HASH = `sha256:${"a".repeat(64)}`;
const temporaryDirectories = [];

function createRepository() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "project-creation-workflow-"));
  temporaryDirectories.push(directory);
  execFileSync("git", ["init", "--initial-branch=main", directory], { stdio: "ignore" });
  fs.writeFileSync(path.join(directory, "README.md"), "fixture\n", "utf8");
  execFileSync("git", ["-C", directory, "add", "README.md"]);
  execFileSync(
    "git",
    [
      "-C",
      directory,
      "-c",
      "user.name=Nuthouse Tests",
      "-c",
      "user.email=tests@nuthouse.invalid",
      "commit",
      "-m",
      "fixture",
    ],
    { stdio: "ignore" },
  );
  return { directory, gitContext: discoverGitContext(directory) };
}

function projectCreationPolicyInput(profile, runtime) {
  const runtimeInput =
    runtime === "claude-code"
      ? {
          projectIntent: "explicit",
          request: "Create the Linear project from the approved source",
          branch: "main",
          linear: { teamKeys: ["NOT"] },
          configuration: { invocationProfile: profile },
          riskEvidence: [],
        }
      : {
          project_intent: "explicit",
          prompt: "Create the Linear project from the approved source",
          git: { branch: "main" },
          linear: { team_keys: ["NOT"] },
          configuration: { invocation_profile: profile },
          risk_evidence: [],
        };
  const normalized = normalizeRuntimeWorkflowInput(runtime, runtimeInput);

  return {
    configuration: resolveConfiguration(normalized.configuration),
    workflow: classifyWorkflow({
      projectIntent: normalized.projectIntent,
      request: normalized.request,
      branch: normalized.branch,
      linearTeamKeys: normalized.linearTeamKeys,
    }),
    riskEvidence: normalized.riskEvidence,
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function profileArtifacts(profile) {
  const row = createProject.split("\n").find((line) => line.includes(`| \`${profile}\``));
  return [...row.matchAll(/`([a-z][a-z0-9-]+)`/g)].slice(1).map((match) => match[1]);
}

test("project creation opens or consumes one install-local workflow run", () => {
  expect(createProject).toContain("${CLAUDE_PLUGIN_ROOT}/lib/workflow/index.mjs");
  expect(createProject).toContain("resolveWorkflowDecision");
  expect(createProject).toContain("consumeManifestHandoff");
  expect(createProject).toContain("writeDecisionManifest");
  for (const field of [
    "discoverGitContext",
    "normalizeRuntimeWorkflowInput",
    "classifyWorkflow",
    "resolveConfiguration",
    "runId",
    "expiresAt",
    "expectedRevision",
    "observedContentHash",
    "resolveAuthoritatively",
  ]) {
    expect(createProject, field).toContain(field);
  }
  expect(createProject).toContain("bundle.json");
  expect(createProject).toContain('workflow !== "project-creation"');
  expect(createProject).toContain("runtime-drift");
  expect(createProject).toContain("one authoritative workflow run");
  expect(createProject).toContain("let currentRun = resolveWorkflowDecision");
  expect(createProject).toContain("artifacts: bootstrapArtifactRefs");
  expect(createProject).toContain("observedContentHash: currentRun.contentHash");
  expect(createProject).toContain("content-hash-mismatch");
  expect(createProject).toContain("invalid-manifest-handoff");
  expect(createProject).not.toContain("Invoke `warden:mode`");
});

test("the install-local kernel persists, reuses, updates, and recovers the same run", () => {
  const { directory, gitContext } = createRepository();

  for (const runtime of ["claude-code", "codex"]) {
    for (const profile of ["quick", "standard", "strict"]) {
      const runId = `project-creation-${runtime}-${profile}`;
      const currentRun = resolveWorkflowDecision({
        gitContext,
        runId,
        policyHash: POLICY_HASH,
        expiresAt: EXPIRES_AT,
        policyInput: projectCreationPolicyInput(profile, runtime),
        artifacts: [],
        expectedRevision: 0,
        now: NOW,
      });
      expect(currentRun.decision.workflow).toBe("project-creation");
      expect(currentRun.decision.effectiveProfile).toBe(profile);
      expect(currentRun.manifest.artifacts).toEqual([]);

      const reused = consumeManifestHandoff({
        handoff: currentRun.handoff,
        gitContext,
        policyHash: POLICY_HASH,
        now: NOW,
      });
      expect(reused.reused).toBe(true);
      expect(reused.manifest.runId).toBe(runId);
    }
  }

  const currentRun = resolveWorkflowDecision({
    gitContext,
    runId: "project-creation-owner-transition",
    policyHash: POLICY_HASH,
    expiresAt: EXPIRES_AT,
    policyInput: projectCreationPolicyInput("standard", "claude-code"),
    artifacts: [],
    expectedRevision: 0,
    now: NOW,
  });
  const artifactPath = path.join(directory, "acceptance.md");
  fs.writeFileSync(artifactPath, "- [AC-001] WHEN invoked, THE SYSTEM SHALL persist.\n", "utf8");
  const artifacts = [
    {
      id: "acceptance-register",
      path: artifactPath,
      contentHash: `sha256:${"b".repeat(64)}`,
    },
  ];
  const updated = writeDecisionManifest(
    gitContext,
    {
      runId: currentRun.manifest.runId,
      policy: currentRun.manifest.decision,
      artifacts,
      policyHash: currentRun.manifest.policyHash,
      expiresAt: currentRun.manifest.expiresAt,
    },
    {
      expectedRevision: currentRun.manifest.revision,
      observedContentHash: currentRun.contentHash,
      now: NOW,
    },
  );
  expect(updated.manifest.artifacts).toEqual(artifacts);
  expect(() =>
    writeDecisionManifest(
      gitContext,
      {
        runId: currentRun.manifest.runId,
        policy: currentRun.manifest.decision,
        artifacts,
        policyHash: currentRun.manifest.policyHash,
        expiresAt: currentRun.manifest.expiresAt,
      },
      {
        expectedRevision: currentRun.manifest.revision,
        observedContentHash: currentRun.contentHash,
        now: NOW,
      },
    ),
  ).toThrow(expect.objectContaining({ code: "workflow-state-conflict" }));

  let resolverCalls = 0;
  const recovered = consumeManifestHandoff(
    {
      handoff: { ...updated.handoff, content_hash: `sha256:${"c".repeat(64)}` },
      gitContext,
      policyHash: POLICY_HASH,
      now: NOW,
      replacement: { expiresAt: EXPIRES_AT, artifacts },
    },
    {
      resolveAuthoritatively: () => {
        resolverCalls += 1;
        return updated.manifest.decision;
      },
    },
  );
  expect(recovered.manifest.runId).toBe(updated.manifest.runId);
  expect(resolverCalls).toBe(1);

  expect(() =>
    consumeManifestHandoff(
      {
        handoff: { ...recovered.handoff, content_hash: "not-a-hash" },
        gitContext,
        policyHash: POLICY_HASH,
        now: NOW,
        replacement: { expiresAt: EXPIRES_AT, artifacts },
      },
      {
        resolveAuthoritatively: () => {
          resolverCalls += 1;
          return recovered.manifest.decision;
        },
      },
    ),
  ).toThrow(expect.objectContaining({ code: "invalid-manifest-handoff" }));
  expect(resolverCalls).toBe(1);
});

test("quick keeps a stable acceptance register and still builds the complete preview", () => {
  expect(createProject).toContain("project-brief");
  expect(createProject).toContain("acceptance-register");
  expect(createProject).toContain("Never renumber");
  expect(createProject).toContain("no active Acceptance section");
  expect(createProject).toContain(
    "require the user to approve or revise it exactly as in vibe mode",
  );
  expect(createProject).toContain("quick");
  expect(createProject).toContain("one complete cascade preview");
  expect(createProject).toContain("project, milestones, issues, dependencies");
});

test("standard and strict require their profile-owned artifacts", () => {
  expect(profileArtifacts("quick")).toEqual(["project-brief", "acceptance-register"]);
  expect(profileArtifacts("standard")).toEqual([
    "project-brief",
    "acceptance-register",
    "audited-spec",
    "project-plan",
  ]);
  expect(profileArtifacts("strict")).toEqual([
    "project-brief",
    "acceptance-register",
    "audited-spec",
    "project-plan",
    "guided-spec-review",
    "constitution-gates",
    "typed-contracts",
    "quickstart-evidence",
    "codebase-map",
  ]);
  for (const artifactType of [
    "audited-spec",
    "project-plan",
    "guided-spec-review",
    "constitution-gates",
    "typed-contracts",
    "quickstart-evidence",
    "codebase-map",
  ]) {
    expect(createProject, artifactType).toContain(artifactType);
  }
  expect(createProject).toContain('status: "not-applicable"');
  expect(createProject).toContain("Artifact ownership is closed and deterministic");
  expect(createProject).toContain("no-whitespace JSON array");
  expect(createProject).toContain("effective profile");
  expect(writeSpec).toContain("mark only requested, gate-passing entries complete");
  expect(writeSpec).not.toContain("REQUESTED_ARTIFACTS: audited-spec, guided-spec-review");
  expect(writePlan).toContain("standard project-creation return");
  expect(writePlan).toContain("skip contract files, quickstart, codebase-map output");
  expect(writePlan).toContain("strict");
});

test("missing upstream artifacts return through their owner without changing runs", () => {
  for (const skill of [createProject, writeSpec, writePlan]) {
    expect(skill).toContain("WORKFLOW_HANDOFF");
    expect(skill).toContain("run_id");
    expect(skill).toContain("path");
    expect(skill).toContain("content_hash");
    expect(skill).toContain("ARTIFACT_INVENTORY");
    expect(skill).toContain("ARTIFACT_INVENTORY_HASH");
    expect(skill).toContain("RETURN_TARGET: linear-devotee:create-project");
  }

  expect(createProject).toContain("artifact_type");
  expect(createProject).toContain("content_hash");
  expect(createProject).toContain("completed_capabilities");
  expect(createProject).toContain("must not dispatch its owner again");
  expect(createProject).toContain("explicit return target");
});

test("the project drafter consumes the same profile inventory and source acceptance truth", () => {
  expect(projectDrafter).toContain("EFFECTIVE_PROFILE");
  expect(projectDrafter).toContain("ARTIFACT_INVENTORY");
  expect(projectDrafter).toContain("ACCEPTANCE_REGISTER");
  expect(projectDrafter).toContain("ACCEPTANCE_REGISTER_HASH");
  expect(projectDrafter).toContain("source of truth");
  expect(projectDrafter).toContain("content_hash");
  expect(projectDrafter).toContain("deterministic");
});

test("adaptive handoffs include every hash required by the receiving boundary", () => {
  const drafterInvocation = createProject.slice(
    createProject.indexOf("Dispatch the logical `linear-devotee:project-drafter`"),
    createProject.indexOf("6. Clarify:"),
  );
  expect(drafterInvocation).toContain("ARTIFACT_INVENTORY_HASH: <artifact_inventory_hash>");
  expect(drafterInvocation).toContain("ACCEPTANCE_REGISTER_HASH: <acceptance_register_hash>");
});

test("fresh decisions include the complete configuration stack and artifact risk evidence", () => {
  expect(createProject).toContain("readWorktreeOverride(gitContext");
  expect(createProject).toContain("personalConfigPath");
  expect(createProject).toContain("repositoryConfigPath");
  expect(createProject).toContain('source: "approved-spec"');
  expect(createProject).toContain("before `resolveWorkflowDecision`");
  expect(createProject).toContain("bootstrapArtifactRefs");
  expect(createProject).toContain('projectIntent: "explicit"');
  expect(createProject).toContain('project_intent: "explicit"');
  expect(createProject).toContain("validatedLinearTeamKeys");
});

test("a validated Acid artifact set bootstraps the new run without owner redispatch", () => {
  for (const field of ["ARTIFACT_SET_RECEIPT", "ARTIFACT_SET_RECEIPT_HASH"]) {
    expect(createProject, field).toContain(field);
    expect(writePlan, field).toContain(field);
  }
  expect(createProject).toContain("bootstrap owner receipt");
  expect(createProject).toContain("must not redispatch its owner");
  expect(writePlan).toContain('owner: "acid-prophet:write-plan"');
});

test("adaptive partial cascades resume only through create-project", () => {
  expect(createProject).toContain("reinvoke `linear-devotee:create-project`");
  expect(createProject).toContain(
    "recompute every complete entry's raw-file or canonical directory digest",
  );
  expect(createProject).toContain("before the project graph loader or any other Linear read");
  for (const skill of [createIssue, createMilestone]) {
    expect(skill).toContain("adaptive_resume_requires_create_project");
    expect(skill).toContain("workflow_handoff");
    expect(skill).toContain("artifact_inventory_hash");
    expect(skill).toContain("acceptance_register_hash");
  }
});

test("directory artifacts use the same byte-framed digest at producer and verifier", () => {
  for (const contract of [createProject, projectDrafter, writePlan]) {
    expect(contract).toMatch(/symlinks and\s+non-regular files/);
    expect(contract).toMatch(/ASCII\s+base-10\s+byte\s+length\s+without\s+leading\s+zeros/);
    expect(contract).toMatch(/normalized POSIX relative path/);
  }
});

test("strict planning accepts only the requested missing owner subset", () => {
  expect(writePlan).toMatch(/non-empty sorted\s+subset/);
  expect(writePlan).toMatch(/must still have\s+`status: "missing"`/);
  expect(writePlan).toMatch(/must not\s+regenerate or rewrite them/);
  expect(writePlan).not.toContain(
    "require the sorted set `project-plan`,\n`constitution-gates`, `typed-contracts`, `quickstart-evidence`, and `codebase-map`",
  );
});

test("one approved payload hash remains the only cascade mutation gate", () => {
  expect(createProject).toContain("artifact_inventory_hash");
  expect(createProject).toContain("cascade_preview");
  expect(createProject).toContain("beside—not inside");
  expect(createProject).toContain("workflow_handoff");
  expect(createProject).toContain("approved_payload_hash");
  expect(createProject).toContain("confirmed_operations");
  expect(createProject).toContain("single global gate");
  expect(createProject).toContain("No further per-resource gate");
  expect(createProject).toContain("retry only operations still absent");
  expect(createProject).toContain("invalidate the cascade and rebuild the preview");
  expect(createProject).toContain("## Canonical mutation envelope");
  expect(createProject).toContain("teamIds");
  expect(createProject).toContain("statusId");
  expect(createProject).toContain("labelIds");
});

test("ambiguous first project writes resolve by marker before retry", () => {
  expect(createProject).not.toContain("and `project.id` exists");
  expect(createProject).toContain("PROJECT_ID: <persisted id | _unknown_>");
  expect(projectGraphLoader).toContain("PROJECT_ID: <Linear project id | _unknown_>");
  expect(projectGraphLoader).toContain("mcp__claude_ai_Linear__list_projects");
  expect(projectGraphLoader).toContain("project-correlation-unknown");
  expect(projectGraphLoader).toContain("never retry project creation");
});
