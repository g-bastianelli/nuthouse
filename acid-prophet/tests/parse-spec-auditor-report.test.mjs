import { expect, test } from "bun:test";
import { parseSpecAuditorReport } from "../lib/parse-spec-auditor-report.mjs";

const cleanReport = `# spec-auditor report — /abs/spec.md

## Gates
- simplicity: pass
- anti-abstraction: pass
- behavior-consistent: pass
- acceptance-defined: pass
- acceptance-traceable: pass
- clarifications-resolved: pass
- constitution: n/a
- handoff-eligible: yes

## BLOCKER (0)

## WARNING (0)

## INFO (0)

## Auto-fix candidates
(no auto-fixes proposed)

## Summary
0 blocker · 0 warning · 0 info
`;

const blockedReport = cleanReport
  .replace("behavior-consistent: pass", "behavior-consistent: fail")
  .replace("handoff-eligible: yes", "handoff-eligible: no")
  .replace(
    "## BLOCKER (0)",
    "## BLOCKER (1)\n- [consistency:AC-002] viewer both allowed and forbidden; choose the intended outcome",
  )
  .replace("0 blocker ·", "1 blocker ·");

test("a complete coherent report permits handoff", () => {
  expect(parseSpecAuditorReport(cleanReport)).toMatchObject({
    handoffEligible: true,
    blockers: [],
    gates: { "behavior-consistent": "pass", constitution: "n/a" },
    summary: { blocker: 0, warning: 0, info: 0 },
  });
});

test("a behavioral contradiction prevents handoff and preserves its evidence", () => {
  const result = parseSpecAuditorReport(blockedReport);
  expect(result.handoffEligible).toBe(false);
  expect(result.blockers).toEqual([
    "[consistency:AC-002] viewer both allowed and forbidden; choose the intended outcome",
  ]);
});

test("a claimed yes never overrides a failing gate or blocker", () => {
  expect(
    parseSpecAuditorReport(blockedReport.replace("handoff-eligible: no", "handoff-eligible: yes"))
      .handoffEligible,
  ).toBe(false);
  expect(
    parseSpecAuditorReport(cleanReport.replace("simplicity: pass", "simplicity: fail"))
      .handoffEligible,
  ).toBe(false);
  const onlyBlocker = blockedReport
    .replace("behavior-consistent: fail", "behavior-consistent: pass")
    .replace("handoff-eligible: no", "handoff-eligible: yes");
  expect(parseSpecAuditorReport(onlyBlocker).handoffEligible).toBe(false);
});

test("explicit refusal is preserved even with passing gates", () => {
  expect(
    parseSpecAuditorReport(cleanReport.replace("handoff-eligible: yes", "handoff-eligible: no"))
      .handoffEligible,
  ).toBe(false);
});

test("warnings, infos, and proposed metadata fixes survive parsing without blocking", () => {
  const report = cleanReport
    .replace(
      "## WARNING (0)",
      "## WARNING (1)\n- [testing:AC-001] add a boundary example; the specified result is already unambiguous",
    )
    .replace("## INFO (0)", "## INFO (1)\n- [style:Solution] long paragraph")
    .replace("(no auto-fixes proposed)", "- last-reviewed:missing → 2026-09-07")
    .replace("0 warning · 0 info", "1 warning · 1 info");
  expect(parseSpecAuditorReport(report)).toMatchObject({
    handoffEligible: true,
    warnings: [
      "[testing:AC-001] add a boundary example; the specified result is already unambiguous",
    ],
    infos: ["[style:Solution] long paragraph"],
    autoFixes: ["last-reviewed:missing → 2026-09-07"],
  });
});

test("whitespace and CRLF do not change a verdict", () => {
  const varied = cleanReport.replace("## BLOCKER (0)", "## BLOCKER  (0)").replaceAll("\n", "\r\n");
  expect(parseSpecAuditorReport(varied)).toEqual(parseSpecAuditorReport(cleanReport));
});

test("a bulleted empty auto-fix marker is not a proposed mutation", () => {
  const report = cleanReport.replace("(no auto-fixes proposed)", "- (no auto-fixes proposed)");
  expect(parseSpecAuditorReport(report).autoFixes).toEqual([]);
});

test.each([
  ["missing required gate", cleanReport.replace("- acceptance-traceable: pass\n", "")],
  ["missing gates section", cleanReport.replace(/## Gates[\s\S]*?(?=## BLOCKER)/, "")],
  ["missing verdict", cleanReport.replace("- handoff-eligible: yes\n", "")],
  [
    "duplicate gate",
    cleanReport.replace("- simplicity: pass", "- simplicity: fail\n- simplicity: pass"),
  ],
  [
    "duplicate verdict",
    cleanReport.replace(
      "- handoff-eligible: yes",
      "- handoff-eligible: no\n- handoff-eligible: yes",
    ),
  ],
  ["unknown gate", cleanReport.replace("- simplicity: pass", "- arbitrary-check: pass")],
  ["invalid gate value", cleanReport.replace("- simplicity: pass", "- simplicity: yes")],
  [
    "unassessed mandatory behavior",
    cleanReport.replace("- behavior-consistent: pass", "- behavior-consistent: n/a"),
  ],
  ["invalid verdict", cleanReport.replace("handoff-eligible: yes", "handoff-eligible: pass")],
  [
    "hidden blocker",
    cleanReport.replace(
      "## BLOCKER (0)",
      "## BLOCKER (0)\n- [consistency:AC-002] conflicting outcomes",
    ),
  ],
  ["summary mismatch", blockedReport.replace("1 blocker ·", "0 blocker ·")],
  ["heading mismatch", blockedReport.replace("## BLOCKER (1)", "## BLOCKER (0)")],
  ["duplicate section", cleanReport.replace("## BLOCKER (0)", "## BLOCKER (0)\n\n## BLOCKER (0)")],
  [
    "unparsed finding",
    cleanReport.replace("## BLOCKER (0)", "## BLOCKER (0)\n- a defect with no category"),
  ],
  ["missing summary", cleanReport.replace(/## Summary[\s\S]*/, "")],
  ["missing bucket", cleanReport.replace("## WARNING (0)\n", "")],
  ["trailing unparsed content", cleanReport + "another blocker\n"],
])("rejects incomplete or contradictory transport: %s", (_name, report) => {
  expect(parseSpecAuditorReport(report)).toBeNull();
});

test.each([null, undefined, 42, "", "   ", "not a report"])(
  "rejects non-report input %p",
  (raw) => {
    expect(parseSpecAuditorReport(raw)).toBeNull();
  },
);
