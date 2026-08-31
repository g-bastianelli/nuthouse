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

process.stdout.write(
  `${JSON.stringify({
    plugin: path.basename(pluginRoot),
    sourceHash: metadata.sourceHash,
    decisions: parity.decisions.length,
    fallbacks: parity.claudeHookFallbacks.length,
    verificationCases: verification.cases.length,
  })}\n`,
);
