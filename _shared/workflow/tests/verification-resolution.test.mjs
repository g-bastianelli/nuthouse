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

  test("merges native commands with exact repository-owned provenance", () => {
    const result = resolveVerificationStrategy({
      moonWorkspace: false,
      nativeVerification: {
        sources: [
          {
            source: "repository-instructions",
            path: "AGENTS.md",
            commands: ["bun run lint"],
          },
          {
            source: "repository-instructions",
            path: "packages/app/CLAUDE.md",
            commands: ["bun test"],
          },
          {
            source: "repository-build-metadata",
            path: "package.json",
            commands: ["bun run lint", "bun run typecheck"],
          },
          {
            source: "repository-build-metadata",
            path: "Taskfile.yml",
            commands: ["task verify"],
          },
        ],
      },
    });

    expect(result).toMatchObject({
      status: "ready",
      strategy: "native",
      verifier: "repository-owned",
      commands: ["bun run lint", "bun test", "bun run typecheck", "task verify"],
      targets: ["repository"],
    });
    expect(result.provenance).toEqual([
      { command: "bun run lint", source: "repository-instructions", path: "AGENTS.md" },
      {
        command: "bun test",
        source: "repository-instructions",
        path: "packages/app/CLAUDE.md",
      },
      {
        command: "bun run typecheck",
        source: "repository-build-metadata",
        path: "package.json",
      },
      {
        command: "task verify",
        source: "repository-build-metadata",
        path: "Taskfile.yml",
      },
    ]);
  });

  test("uses Moon Moth only for a declared Moon workspace and affected targets", () => {
    const specializedVerifier = {
      id: "moon-moth:verify",
      available: true,
      source: "moon-moth:verify",
      commands: ["moon run :test --affected"],
      targets: ["app"],
    };
    const nativeVerification = {
      sources: [
        {
          source: "repository-build-metadata",
          path: "package.json",
          commands: ["bun test"],
        },
      ],
    };

    expect(
      resolveVerificationStrategy({
        moonWorkspace: true,
        specializedVerifier,
        nativeVerification,
      }),
    ).toMatchObject({
      strategy: "specialized",
      verifier: "moon-moth:verify",
      targets: ["app"],
    });
    expect(
      resolveVerificationStrategy({
        moonWorkspace: false,
        specializedVerifier,
        nativeVerification,
      }),
    ).toMatchObject({
      strategy: "native",
      commands: ["bun test"],
      targets: ["repository"],
    });
  });

  test("blocks unknown native provenance, traversal, multiline commands, and incomplete Moon data", () => {
    const cases = [
      {
        moonWorkspace: false,
        nativeVerification: {
          sources: [{ source: "model-guess", path: "CLAUDE.md", commands: ["bun test"] }],
        },
      },
      {
        moonWorkspace: false,
        nativeVerification: {
          sources: [
            {
              source: "repository-instructions",
              path: "README.md",
              commands: ["bun test"],
            },
          ],
        },
      },
      {
        moonWorkspace: false,
        nativeVerification: {
          sources: [
            {
              source: "repository-build-metadata",
              path: "../package.json",
              commands: ["bun test"],
            },
          ],
        },
      },
      {
        moonWorkspace: false,
        nativeVerification: {
          sources: [
            {
              source: "repository-build-metadata",
              path: "package.json",
              commands: ["bun test\nbun run lint"],
            },
          ],
        },
      },
      {
        moonWorkspace: true,
        specializedVerifier: {
          id: "moon-moth:verify",
          available: true,
          commands: ["moon run :test --affected"],
          targets: [],
        },
        nativeVerification: {
          sources: [
            {
              source: "repository-build-metadata",
              path: "package.json",
              commands: ["bun test"],
            },
          ],
        },
      },
    ];

    for (const input of cases) {
      expect(resolveVerificationStrategy(input)).toMatchObject({
        status: "blocked",
        strategy: "none",
        blocked: true,
      });
    }
  });
});
