import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const pluginRoot = path.resolve(process.argv[2] ?? "");
const bundleRoot = path.join(pluginRoot, "lib", "workflow");
const workflow = await import(pathToFileURL(path.join(bundleRoot, "index.mjs")).href);
const parity = JSON.parse(
  fs.readFileSync(path.join(bundleRoot, "fixtures", "runtime-parity.json"), "utf8"),
);
const verification = JSON.parse(
  fs.readFileSync(path.join(bundleRoot, "fixtures", "verification-fallbacks.json"), "utf8"),
);
const directTask = JSON.parse(
  fs.readFileSync(path.join(bundleRoot, "fixtures", "direct-task-delivery.json"), "utf8"),
);
const metadata = JSON.parse(fs.readFileSync(path.join(bundleRoot, "bundle.json"), "utf8"));

for (const fixture of parity.decisions) {
  const claude = workflow.resolveClaudeWorkflow(fixture.claude);
  const codex = workflow.resolveCodexWorkflow(fixture.codex);
  assert.deepEqual(claude.decision, codex.decision);
  assert.equal(workflow.normalizeDecisionJson(claude), workflow.normalizeDecisionJson(codex));
  assert.equal(claude.decision.workflow, fixture.expected.workflow);
  assert.equal(claude.decision.requestedProfile, fixture.expected.requestedProfile);
  assert.equal(claude.decision.effectiveProfile, fixture.expected.effectiveProfile);
  assert.equal(claude.decision.blocked, fixture.expected.blocked);
}

const fallbackFixture = parity.decisions[1];
const codexDecision = workflow.resolveCodexWorkflow(fallbackFixture.codex).decision;
const missing = workflow.resolveClaudeWorkflow(fallbackFixture.claude);
const failed = workflow.resolveClaudeWorkflow(fallbackFixture.claude, {
  resolveHook() {
    throw new Error("hook failed");
  },
});
const invalid = workflow.resolveClaudeWorkflow(fallbackFixture.claude, {
  resolveHook: () => ({ workflow: "issue-delivery", effectiveProfile: "turbo" }),
});
const policyFixture = parity.decisions[2];
const policyDecision = workflow.resolveCodexWorkflow(policyFixture.codex).decision;
const policyMismatch = workflow.resolveClaudeWorkflow(policyFixture.claude, {
  resolveHook: () => ({
    ...policyDecision,
    riskFloor: "quick",
    effectiveProfile: "quick",
    normalizedEvidence: [],
    activeRisks: [],
    escalations: [],
    enabledCapabilities: [],
    resolvedCapabilities: [],
    diagnostics: [],
  }),
});

assert.deepEqual(missing.decision, codexDecision);
assert.deepEqual(failed.decision, codexDecision);
assert.deepEqual(invalid.decision, codexDecision);
assert.deepEqual(policyMismatch.decision, policyDecision);
assert.equal(missing.fallbackReason, "hook-missing");
assert.equal(failed.fallbackReason, "hook-failed");
assert.equal(invalid.fallbackReason, "hook-invalid");
assert.equal(policyMismatch.source, "explicit-skill");
assert.equal(policyMismatch.fallbackReason, "hook-policy-mismatch");

for (const fixture of verification.cases) {
  assert.deepEqual(
    Object.fromEntries(
      Object.keys(fixture.expected).map((field) => [
        field,
        workflow.resolveVerificationStrategy(fixture.input)[field],
      ]),
    ),
    fixture.expected,
  );
}

for (const profile of directTask.profiles) {
  const preparation = workflow.prepareDirectTask({
    task: directTask.task,
    decision: profile.decision,
    decisionHandoff: directTask.decisionHandoff,
    scope: directTask.scope,
    artifacts: profile.artifacts,
    nativeVerification: directTask.nativeVerification,
  });
  assert.equal(preparation.status, profile.expected.status);
  assert.equal(preparation.preparation, profile.expected.preparation);
  assert.equal(preparation.blocked, profile.expected.blocked);
  assert.deepEqual(preparation.decisionHandoff, directTask.decisionHandoff);
}

const quickProfile = directTask.profiles.find((profile) => profile.id === "quick");
assert.ok(quickProfile);
const moonPreparation = workflow.prepareDirectTask({
  task: directTask.task,
  decision: quickProfile.decision,
  decisionHandoff: directTask.decisionHandoff,
  scope: directTask.moonScope,
  artifacts: quickProfile.artifacts,
  specializedVerifier: directTask.moonVerifier,
});
assert.equal(moonPreparation.status, "ready");
assert.deepEqual(moonPreparation.verification.targets, directTask.moonVerifier.targets);
const mismatchedMoonVerifier = workflow.prepareDirectTask({
  task: directTask.task,
  decision: quickProfile.decision,
  decisionHandoff: directTask.decisionHandoff,
  scope: directTask.moonScope,
  artifacts: quickProfile.artifacts,
  specializedVerifier: { ...directTask.moonVerifier, targets: ["other"] },
});
assert.equal(mismatchedMoonVerifier.status, "blocked");
assert.equal(mismatchedMoonVerifier.diagnostics[0].code, "moon-verifier-target-mismatch");
const unprovenNative = workflow.prepareDirectTask({
  task: directTask.task,
  decision: quickProfile.decision,
  decisionHandoff: directTask.decisionHandoff,
  scope: directTask.scope,
  artifacts: quickProfile.artifacts,
  nativeVerification: { source: "repository-instructions", commands: ["bun test"] },
});
assert.equal(unprovenNative.status, "blocked");
assert.equal(unprovenNative.diagnostics[0].code, "native-verification-provenance-required");
const quickPreparation = workflow.prepareDirectTask({
  task: directTask.task,
  decision: quickProfile.decision,
  decisionHandoff: directTask.decisionHandoff,
  scope: directTask.scope,
  artifacts: quickProfile.artifacts,
  nativeVerification: directTask.nativeVerification,
});
const snapshot = {
  head_oid: "1111111111111111111111111111111111111111",
  worktree_snapshot_hash: "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
  changed_paths: directTask.scope.approvedPaths,
  verified_files: directTask.scope.approvedPaths.map((filePath, index) => ({
    path: filePath,
    type: "regular-file",
    mode: "0644",
    before_hash: null,
    verified_content_hash: `sha256:${String(index + 1).repeat(64)}`,
  })),
};
const evidence = {
  run_id: quickPreparation.decisionHandoff.run_id,
  decision_content_hash: quickPreparation.decisionHandoff.content_hash,
  ...snapshot,
  results: quickPreparation.verification.commands.map((command) => ({
    command,
    targets: quickPreparation.verification.targets,
    exitStatus: 0,
    summary: `${command} passed`,
  })),
};
const completion = workflow.evaluateDirectTaskCompletion({
  preparation: quickPreparation,
  changedPaths: directTask.scope.approvedPaths,
  evidence,
  currentSnapshot: snapshot,
});
assert.equal(completion.status, "completed");
assert.equal(completion.blocked, false);
const forgedCompletion = workflow.evaluateDirectTaskCompletion({
  preparation: {
    ...quickPreparation,
    verification: { ...quickPreparation.verification, commands: [], targets: [], provenance: [] },
  },
  changedPaths: directTask.scope.approvedPaths,
  evidence,
  currentSnapshot: snapshot,
});
assert.equal(forgedCompletion.status, "blocked");
assert.equal(forgedCompletion.diagnostics[0].code, "invalid-direct-task-preparation");

process.stdout.write(
  `${JSON.stringify({
    plugin: path.basename(pluginRoot),
    sourceHash: metadata.sourceHash,
    decisions: parity.decisions.length,
    fallbacks: parity.claudeHookFallbacks.length,
    verificationCases: verification.cases.length,
    directTaskProfiles: directTask.profiles.length,
    directTaskCompletion: completion.status,
  })}\n`,
);
