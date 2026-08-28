import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const WARDEN_ROOT = path.resolve(import.meta.dir, "..");
const MODE_SKILL = fs.readFileSync(path.join(WARDEN_ROOT, "skills", "mode", "SKILL.md"), "utf8");
const MODE_OPENAI = fs.readFileSync(
  path.join(WARDEN_ROOT, "skills", "mode", "agents", "openai.yaml"),
  "utf8",
);

describe("warden:mode skill contract", () => {
  test("exposes the five mode actions through the bundled client", () => {
    expect(MODE_SKILL).toContain("name: mode");
    expect(MODE_SKILL).toContain('argument-hint: "[quick|standard|strict|status|reset]"');
    for (const action of ["quick", "standard", "strict", "status", "reset"]) {
      expect(MODE_SKILL).toContain(`\`${action}\``);
    }
    expect(MODE_SKILL).toContain("scripts/mode.mjs");
    expect(MODE_SKILL).toContain("Do not fall back to repository-only `_shared` files");
  });

  test("requires every inspectable status field", () => {
    for (const field of [
      "Requested profile",
      "Effective profile",
      "Configuration sources",
      "Escalations",
      "Enabled capabilities",
      "Diagnostics",
      "Blocked",
    ]) {
      expect(MODE_SKILL).toContain(field);
    }
  });

  test("keeps reset and profile writes scoped to the current worktree", () => {
    expect(MODE_SKILL).toContain("another worktree's override");
    expect(MODE_SKILL).toContain("personal configuration");
    expect(MODE_SKILL).toContain("repository configuration");
    expect(MODE_SKILL).toContain("voice state");
    expect(MODE_SKILL).toContain("force quick");
  });

  test("publishes matching Codex UI metadata", () => {
    expect(MODE_OPENAI).toContain('display_name: "Warden Mode"');
    expect(MODE_OPENAI).toContain("$warden:mode status");
  });
});
