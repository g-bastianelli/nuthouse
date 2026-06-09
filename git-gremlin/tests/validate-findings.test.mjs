import { describe, expect, test } from "bun:test";

import { extractFindingBlocks, validateFindings } from "../scripts/validate-findings.mjs";

describe("validate-findings", () => {
  test("accepts explicit no-findings reports", () => {
    expect(validateFindings("No blocking findings.\nResidual risk: tests not run.")).toEqual({
      valid: true,
      errors: [],
      findings: 0,
    });
  });

  test("requires evidence, impact, and fix for findings", () => {
    const result = validateFindings(`HIGH: Broken cache
File: src/cache.ts:42
Evidence: The new branch skips invalidation.
Impact: Users can read stale data.
Fix: Restore invalidation before returning.
`);

    expect(result.valid).toBe(true);
    expect(result.findings).toBe(1);
  });

  test("rejects vague finding blocks", () => {
    const result = validateFindings(`MEDIUM: This seems odd
File: src/a.ts:1
`);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("finding 1: missing Evidence.");
    expect(result.errors).toContain("finding 1: missing Impact.");
    expect(result.errors).toContain("finding 1: missing Fix.");
  });

  test("extracts multiple severity blocks", () => {
    expect(extractFindingBlocks("HIGH: A\nFile: x:1\n\nLOW: B\nFile: y:2")).toHaveLength(2);
  });
});
