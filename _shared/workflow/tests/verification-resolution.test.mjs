import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

import { resolveVerificationStrategy } from "../src/verification-resolution.mjs";

const FIXTURES = JSON.parse(
  fs.readFileSync(
    path.join(import.meta.dir, "..", "fixtures", "verification-fallbacks.json"),
    "utf8",
  ),
);

describe("verification fallback resolution", () => {
  for (const fixture of FIXTURES.cases) {
    test(`${fixture.id} resolves deterministically (AC-048)`, () => {
      const result = resolveVerificationStrategy(fixture.input);

      expect(result).toMatchObject(fixture.expected);
      if (result.status === "ready") {
        expect(result.commands.length).toBeGreaterThan(0);
        expect(result.diagnostics).toEqual([]);
      } else {
        expect(result.commands).toEqual([]);
        expect(result.diagnostics).toEqual([
          expect.objectContaining({
            code: "verification-strategy-unavailable",
            blocked: true,
          }),
        ]);
      }
    });
  }

  test("rejects empty or synthetic native command sets instead of claiming completion", () => {
    for (const nativeVerification of [
      { source: "repository-instructions", commands: [] },
      { source: "repository-instructions", commands: ["  "] },
      { source: "model-guess", commands: ["bun test"] },
    ]) {
      expect(
        resolveVerificationStrategy({
          specializedVerifier: { id: "moon-moth", available: false, commands: [] },
          nativeVerification,
        }),
      ).toMatchObject({ status: "blocked", strategy: "none" });
    }
  });

  test("deduplicates commands while preserving their declared order", () => {
    const result = resolveVerificationStrategy({
      nativeVerification: {
        source: "repository-instructions",
        commands: ["bun run lint", "bun test", "bun run lint"],
      },
    });

    expect(result.commands).toEqual(["bun run lint", "bun test"]);
  });
});
