import { expect, test } from "bun:test";
import { parseScryerReport } from "../lib/parse-scryer-report.mjs";

const cleanReport = `# scryer report — /abs/spec.md

## BLOCKER (0)

## WARNING (0)

## INFO (0)

## Auto-fix candidates

## Summary
0 blocker · 0 warning · 0 info
`;

const fullReport = `# scryer report — /abs/spec.md

## BLOCKER (2)
- [frontmatter:status] missing
- [section:Testing] missing

## WARNING (1)
- [ambiguity:Solution] vague quantifier "some users"

## INFO (1)
- [style:Components] heavy code block (30 lines) — consider moving to Linear issues

## Auto-fix candidates
- frontmatter:status → "draft"
- frontmatter:last-reviewed → "2026-05-04"

## Summary
2 blocker · 1 warning · 1 info
`;

test("parses a clean (zero-finding) report", () => {
  const out = parseScryerReport(cleanReport);
  expect(out).not.toBeNull();
  expect(out.blockers).toEqual([]);
  expect(out.warnings).toEqual([]);
  expect(out.infos).toEqual([]);
  expect(out.autoFixes).toEqual([]);
  expect(out.summary).toEqual({ blocker: 0, warning: 0, info: 0 });
});

test("parses a full report with findings and auto-fixes", () => {
  const out = parseScryerReport(fullReport);
  expect(out.blockers).toHaveLength(2);
  expect(out.blockers[0]).toContain("[frontmatter:status]");
  expect(out.warnings).toHaveLength(1);
  expect(out.warnings[0]).toContain("vague quantifier");
  expect(out.infos).toHaveLength(1);
  expect(out.autoFixes).toHaveLength(2);
  expect(out.autoFixes[0]).toContain("frontmatter:status");
  expect(out.summary).toEqual({ blocker: 2, warning: 1, info: 1 });
});

test("returns null for malformed input with no Summary section", () => {
  const bad = `# scryer report

## BLOCKER (0)

(no summary line)
`;
  expect(parseScryerReport(bad)).toBeNull();
});

test("returns null for empty string", () => {
  expect(parseScryerReport("")).toBeNull();
});

test("returns null for non-string input", () => {
  expect(parseScryerReport(null)).toBeNull();
  expect(parseScryerReport(undefined)).toBeNull();
  expect(parseScryerReport(42)).toBeNull();
});

test("skips malformed bullets but does not throw", () => {
  const partiallyBad = `# scryer report — /abs/spec.md

## BLOCKER (1)
- [section:Testing] missing
this line is not a bullet
- another stray

## WARNING (0)

## INFO (0)

## Auto-fix candidates

## Summary
1 blocker · 0 warning · 0 info
`;
  const out = parseScryerReport(partiallyBad);
  expect(out).not.toBeNull();
  expect(out.blockers).toHaveLength(1);
  expect(out.blockers[0]).toContain("[section:Testing]");
});

test("handles section headings with whitespace variations", () => {
  const wonky = `# scryer report — /abs/spec.md

## BLOCKER  (0)

## WARNING (0)

## INFO (0)

## Auto-fix candidates

## Summary
0 blocker · 0 warning · 0 info
`;
  const out = parseScryerReport(wonky);
  expect(out).not.toBeNull();
  expect(out.summary.blocker).toBe(0);
});

test("parses summary line with non-zero counts", () => {
  const out = parseScryerReport(fullReport);
  expect(out.summary).toEqual({ blocker: 2, warning: 1, info: 1 });
});

test("preserves bullet text verbatim including brackets", () => {
  const out = parseScryerReport(fullReport);
  expect(out.blockers[0]).toEqual("[frontmatter:status] missing");
  expect(out.blockers[1]).toEqual("[section:Testing] missing");
});

test("round-trips: parse a report and verify all bullets land in the right buckets", () => {
  const out = parseScryerReport(fullReport);
  const total = out.blockers.length + out.warnings.length + out.infos.length;
  const expected = out.summary.blocker + out.summary.warning + out.summary.info;
  expect(total).toEqual(expected);
});
