import { expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dir, "..", "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

test("write-spec creates stable EARS acceptance identifiers and ratifies after approval", () => {
  const skill = read("acid-prophet/skills/write-spec/SKILL.md");

  expect(skill).toContain("- [AC-001] WHEN <trigger>, THE SYSTEM SHALL <observable behavior>");
  expect(skill).toContain("Never renumber or reuse an accepted AC id");
  expect(skill).toContain("status: ratified");
  expect(skill).toContain("verified-by: spec-auditor");
});

test("plans and checklists preserve acceptance ids", () => {
  const plan = read("acid-prophet/skills/write-plan/SKILL.md");
  const checklist = read("acid-prophet/skills/write-checklist/SKILL.md");

  expect(plan).toContain("covers: AC-001");
  expect(plan).toContain("Acceptance coverage");
  expect(checklist).toContain("**[AC-001]");
});

test("automatic commits are replaced by an explicit commit choice", () => {
  for (const relativePath of [
    "acid-prophet/skills/write-spec/SKILL.md",
    "acid-prophet/skills/write-plan/SKILL.md",
    "acid-prophet/skills/write-checklist/SKILL.md",
    "acid-prophet/skills/write-constitution/SKILL.md",
  ]) {
    const skill = read(relativePath);
    expect(skill, relativePath).toContain("Commit the artifact? (y / no)");
  }
});

test("spec versions fail closed and plan audit reports use the deterministic parser", () => {
  const auditor = read("acid-prophet/agents/spec-auditor.md");
  const plan = read("acid-prophet/skills/write-plan/SKILL.md");

  expect(auditor).toContain("`spec-version` must be a base-10 integer ≥ 1");
  expect(plan).toContain("parse-spec-auditor-report.mjs");
  expect(plan).toContain("parseSpecAuditorReport(RAW_REPORT)");
  expect(plan).toContain('gates["acceptance-traceable"] === "pass"');
  expect(plan).toContain("spec-version: <exact source spec-version>");
  expect(plan).not.toContain("source spec-version | 1");
});

test("retired acceptance criteria use one auditable history grammar", () => {
  const writer = read("acid-prophet/skills/write-spec/SKILL.md");
  const auditor = read("acid-prophet/agents/spec-auditor.md");

  expect(writer).toContain("## Acceptance history");
  expect(writer).toContain("retired 2026-08-05");
  expect(auditor).toContain("Retirement history");
  expect(auditor).toContain("Retired ids must be unique in history and disjoint from active ids");
});

test("all downstream consumers exclude retired acceptance history", () => {
  for (const relativePath of [
    "acid-prophet/skills/write-plan/SKILL.md",
    "acid-prophet/skills/write-checklist/SKILL.md",
    "acid-prophet/skills/check-drift/SKILL.md",
  ]) {
    const skill = read(relativePath);
    expect(skill, relativePath).toContain("section headed exactly `Acceptance`");
    expect(skill, relativePath).toContain("exclude `Acceptance history`");
  }
});

test("spec-version is never proposed or applied as an automatic fix", () => {
  const auditor = read("acid-prophet/agents/spec-auditor.md");
  const writer = read("acid-prophet/skills/write-spec/SKILL.md");
  const auditSkill = read("acid-prophet/skills/audit-spec/SKILL.md");

  expect(auditor).toContain("Never emit an Auto-fix candidate for `spec-version`");
  expect(writer).toContain("reject and surface any `spec-version` candidate");
  expect(auditSkill).toContain("reject and surface any `spec-version` entry");
});

test("the ADR documents legacy spec migration", () => {
  const adr = read("_adr/0005-spec-issue-traceability.md");

  expect(adr).toContain("Migration for pre-ADR specs");
  expect(adr).toContain("commonly lack both `spec-version` and `## Acceptance history`");
  expect(adr).toContain("This field is never auto-fixed");
});
