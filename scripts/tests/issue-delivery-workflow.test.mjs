import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

import { validateManifestHandoff } from "../../_shared/workflow/src/manifest-schema.mjs";

const ROOT = path.resolve(import.meta.dir, "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function normalize(document) {
  return document
    .replace(/[`*#|]/g, " ")
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\s+([,;:.!?])/g, "$1")
    .trim()
    .toLowerCase();
}

function expectInOrder(document, fragments) {
  let cursor = 0;
  for (const fragment of fragments) {
    const normalizedFragment = normalize(fragment);
    const index = document.indexOf(normalizedFragment, cursor);
    expect(index, `missing or out-of-order workflow contract: ${fragment}`).toBeGreaterThanOrEqual(
      cursor,
    );
    cursor = index + normalizedFragment.length;
  }
}

function sliceBetween(document, start, end) {
  const startIndex = document.indexOf(start);
  const endIndex = document.indexOf(end, startIndex + start.length);
  expect(startIndex, `missing section start: ${start}`).toBeGreaterThanOrEqual(0);
  expect(endIndex, `missing section end: ${end}`).toBeGreaterThan(startIndex);
  return document.slice(startIndex, endIndex);
}

const greetRaw = read("linear-devotee/skills/greet/SKILL.md");
const verifyRaw = read("moon-moth/skills/verify/SKILL.md");
const greet = normalize(greetRaw);
const plan = normalize(read("linear-devotee/skills/plan/SKILL.md"));
const drift = normalize(read("acid-prophet/skills/check-drift/SKILL.md"));
const checklist = normalize(read("acid-prophet/skills/write-checklist/SKILL.md"));
const scope = normalize(read("moon-moth/skills/scope/SKILL.md"));
const verify = normalize(read("moon-moth/skills/verify/SKILL.md"));
const commit = normalize(read("git-gremlin/skills/commit/SKILL.md"));
const pr = normalize(read("git-gremlin/skills/pr/SKILL.md"));
const maestroContract = normalize(read("monkey-maestro/shared/project-execution-contract.md"));
const orchestrate = normalize(read("monkey-maestro/skills/orchestrate/SKILL.md"));
const spawn = normalize(read("monkey-maestro/skills/spawn/SKILL.md"));
const contextSchema = normalize(read("shared/context-schema.md"));

describe("Linear Devotee issue-delivery planning and handoff", () => {
  test("greet binds the source authorities and workflow decision before planning", () => {
    expectInOrder(greet, [
      "resolve workflow decision",
      "resolve acid prophet spec",
      "resolve project plan authority",
      "write context",
      "handoff",
    ]);
    expect(greet).toContain("workflow_decision");
    expect(greet).toContain("project_plan");
    expect(greet).toContain("content_hash");
    expect(greet).toContain("do not require warden");
  });

  test("source resolution prefers explicit issue authority and follows workflow child ownership", () => {
    for (const document of [greet, plan]) {
      expectInOrder(document, [
        "explicit repository-relative spec path",
        "exact issue id",
        "linear-project:",
        "issue-delivery child spec",
      ]);
      expect(document).toMatch(/child spec.*before.*strict.*gate/s);
      expect(document).toMatch(/parent.*kernel.*govern/s);
    }
  });

  test("quick, standard, and strict share the audit gate and differ only by required evidence", () => {
    expect(plan).toContain("effectiveprofile");
    expect(plan).toContain("linear-devotee:plan-auditor");
    expect(plan).toMatch(/quick.*compact/s);
    expect(plan).toMatch(/plan_review: pass.*spec_drift_detected: no.*blockers:.*none/s);
    expect(plan).toMatch(/quick.*auto-validate only on that exact clean result/s);
    expect(plan).toMatch(/standard.*audited issue-level plan.*before implementation/s);
    expectInOrder(plan, [
      "strict",
      "acid-prophet:check-drift",
      "acid-prophet:write-checklist",
      "implementation_ready",
    ]);
  });

  test("project architecture is inherited by exact reference and never reconstructed", () => {
    expect(plan).toContain("project plan remains architecture authority");
    expect(plan).toMatch(/frontmatter spec:.*repository-relative spec_file/s);
    expect(plan).toContain("record _none_");
    expect(plan).toContain("architecture conflict");
    expect(plan).toContain("block validation");
  });

  test("implementation receives four exact named and hash-bound artifacts", () => {
    for (const field of ["plan_file", "spec_file", "relevant_files", "workflow_decision"]) {
      expect(plan).toContain(field);
    }
    expect(plan).toContain("sha256:");
    expect(plan).toContain("refuse the handoff");
    expect(plan).toContain("content hash");
  });

  test("the workflow decision remains an exact closed manifest handoff", () => {
    const handoff = {
      run_id: "not-553-test",
      path: "/tmp/not-553-test.json",
      content_hash: `sha256:${"a".repeat(64)}`,
    };
    expect(validateManifestHandoff(handoff).ok).toBe(true);
    expect(validateManifestHandoff({ ...handoff, effective_profile: "strict" }).ok).toBe(false);
    expect(plan).toContain(
      "workflow_decision: { run_id: <id>, path: <abs manifest path>, content_hash: sha256:<hex> }",
    );
    expect(plan).toContain(normalize("effective_profile: <quick | standard | strict>"));
    expect(plan).not.toContain("content_hash: sha256:<hex>, effective_profile: <profile> }");
  });

  test("every implementation closes through Moon Moth verification", () => {
    expect(plan).toContain("always close through moon-moth:verify");
    expect(plan).toMatch(/moon-moth:verify.*moon.*repository-native/s);
    expect(plan).toMatch(/moon-moth:verify.*verification_evidence/s);
  });

  test("strict checklist generation consumes the clean drift artifact", () => {
    const strictEvidence = sliceBetween(plan, "collect strict evidence", "handoff:");
    expectInOrder(strictEvidence, [
      "acid-prophet:check-drift",
      "DRIFT_EVIDENCE",
      "acid-prophet:write-checklist",
    ]);
    expect(strictEvidence).toMatch(/write-checklist.*drift_evidence.*path.*content_hash/s);
  });

  test("relay ancestry is consumed without pretending the parent manifest is child-local", () => {
    for (const field of [
      "workflow_run_id",
      "workflow_profile",
      "workflow_decision_hash",
      "parent_workflow_baton",
    ]) {
      expect(greet).toContain(field);
    }
    expect(greet).toMatch(/all three.*or none/s);
    expect(greet).toMatch(/child.*effective profile.*not lower.*workflow_profile/s);
    expect(greet).toMatch(/parent.*manifest.*out-of-scope/s);
  });

  test("session-store relevant_files remains a string array", () => {
    const sessionStore = sliceBetween(greetRaw, "- Session store:", "9. Handoff:");
    expect(sessionStore).toContain('"relevant_files": ["<abs path 1>"]');
    expect(sessionStore).not.toContain(
      '"relevant_files": [{ "path": "<abs path 1>", "content_hash": "sha256:<hex>" }]',
    );
    expect(contextSchema).toContain("relevant_files string[] (abs paths)");
  });
});

describe("Acid Prophet strict evidence ownership", () => {
  test("planned-intent drift is read-only, source-bound, and hash-addressed", () => {
    expect(drift).toContain("strict issue-delivery mode");
    expect(drift).toContain("plan_file");
    expect(drift).toContain("spec_file");
    expect(drift).toContain("workflow_decision");
    expect(drift).toContain("drift_evidence");
    expect(drift).toContain("content_hash");
    expect(drift).toMatch(/never.*patch.*spec/);
  });

  test("the checklist is derived from source ACs but never becomes feature acceptance", () => {
    expect(checklist).toContain("strict issue-delivery mode");
    expect(checklist).toContain("checklist_evidence");
    expect(checklist).toContain("content_hash");
    expect(checklist).toContain("status: open");
    expect(checklist).toContain("human feature acceptance");
    expect(checklist).toMatch(/never.*mark.*accepted/);
  });
});

describe("verification and Git delivery gates", () => {
  test("Moon Moth preserves the named packet and returns command-backed evidence", () => {
    for (const document of [scope, verify]) {
      expect(document).toContain("issue_delivery_packet");
      expect(document).toContain("workflow_decision");
    }
    expect(verify).toContain("verification_evidence");
    expect(verify).toContain("content_hash");
    expect(verify).toContain("repository-native");
    expect(verify).toMatch(/mismatch.*block/s);
    expect(verify).toMatch(/verification.*fail.*do not offer commit\/pr/s);
  });

  test("verification preserves immutable hashes and rebinds mutable targets", () => {
    expect(verify).toContain("immutable inputs");
    expect(verify).toContain("mutable targets");
    expect(verify).toContain("before_hash");
    expect(verify).toContain("verified_content_hash");
    expect(verify).toMatch(/relevant_files.*path set.*unchanged/s);
  });

  test("native verification is terminal from scope and executable without Moon", () => {
    expect(scope).toMatch(/repository-native.*terminal handoff.*return immediately/s);
    expect(verifyRaw).toMatch(/^allowed-tools: Bash,/m);
    expect(verify).toMatch(/moon branch.*verify-runner/s);
    expect(verify).toMatch(
      /repository-native branch.*do not dispatch.*verify-runner.*execute every exact command/s,
    );
    expect(verify).toMatch(/raw.*bun test.*forbidden only.*moon branch/s);
  });

  test("verification and Git mutations bind the exact current Git snapshot", () => {
    for (const field of ["head_oid", "worktree_snapshot_hash", "verified_content_hash"]) {
      expect(verify).toContain(field);
    }
    expect(verify).toMatch(/index-independent.*changed.*path.*content hash/s);
    expect(commit).toMatch(/recompute.*worktree_snapshot_hash.*before.*staging/s);
    expect(commit).toMatch(/recompute.*worktree_snapshot_hash.*immediately before.*commit/s);
    expect(pr).toMatch(/head_oid.*current head.*fresh verification/s);
    expect(pr).toMatch(/changed-path set.*empty.*committed head/s);
    expect(pr).toMatch(/recompute.*worktree_snapshot_hash.*before.*publication/s);
  });

  test("verification snapshots the Git state before any check can mutate it", () => {
    expectInOrder(verify, [
      "step 0 - preconditions",
      "pre-check git snapshot",
      "step 1 - run checks",
      "step 4 - final report",
      "compare the pre-check git snapshot",
    ]);
    expect(verify).toMatch(/do not run.*verification command.*before.*pre-check.*snapshot/s);
  });

  test("commit and PR refuse missing verification and keep acceptance and merge manual", () => {
    for (const document of [commit, pr]) {
      expect(document).toContain("workflow_decision");
      expect(document).toContain("verification_evidence");
      expect(document).toMatch(/missing.*refuse/);
    }
    expect(pr).toContain("human feature acceptance");
    expect(pr).toContain("manual merge");
    expect(pr).toMatch(/never.*automatically.*monkey-maestro/s);
    expect(pr).toMatch(/never.*linear completion/s);
  });

  test("direct Git entry resolves issue delivery before enforcing verification", () => {
    for (const document of [commit, pr]) {
      expectInOrder(document, [
        "resolve the workflow decision",
        "workflow is issue-delivery",
        "verification_evidence",
      ]);
      expect(document).toMatch(/missing.*handoff.*local.*resolution/s);
      expect(document).toMatch(/issue-delivery.*missing.*verification.*refuse/s);
    }
  });

  test("commit binds staged mode and type as well as content", () => {
    expect(commit).toMatch(/staged.*mode.*type.*verification evidence/s);
    expect(commit).toMatch(/mode.*type.*mismatch.*block/s);
  });
});

describe("Monkey Maestro relay baton", () => {
  test("the shared contract validates the exact parent decision identity", () => {
    expect(maestroContract).toContain("workflow baton");
    for (const field of ["workflowrunid", "workflowprofile", "workflowdecisionhash"]) {
      expect(maestroContract).toContain(field);
    }
    expect(maestroContract).toMatch(/missing.*mismatch.*refuse/s);
    expect(maestroContract).toContain("does not authorize feature acceptance");
    expect(maestroContract).toContain("does not authorize merge");
    expect(maestroContract).toContain("does not authorize linear completion");
  });

  test("both worktree creation paths bind the baton into immutable worker prompts", () => {
    for (const document of [orchestrate, spawn]) {
      expect(document).toContain("workflow_run_id");
      expect(document).toContain("workflow_profile");
      expect(document).toContain("workflow_decision_hash");
      expect(document).toContain("immutable worker prompt");
      expect(document).toMatch(/missing.*mismatch.*launches nothing/s);
    }
  });

  test("relay never weakens human delivery gates", () => {
    for (const document of [orchestrate, spawn]) {
      expect(document).toContain("human feature acceptance");
      expect(document).toContain("manual merge");
      expect(document).toContain("linear completion");
    }
  });
});
