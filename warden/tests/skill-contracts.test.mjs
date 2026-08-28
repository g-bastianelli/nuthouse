import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const WARDEN_ROOT = path.resolve(import.meta.dir, "..");
const MODE_SKILL = fs.readFileSync(path.join(WARDEN_ROOT, "skills", "mode", "SKILL.md"), "utf8");
const MODE_OPENAI = fs.readFileSync(
  path.join(WARDEN_ROOT, "skills", "mode", "agents", "openai.yaml"),
  "utf8",
);
const ROUTE_SKILL = fs.readFileSync(path.join(WARDEN_ROOT, "skills", "route", "SKILL.md"), "utf8");
const ROUTE_OPENAI = fs.readFileSync(
  path.join(WARDEN_ROOT, "skills", "route", "agents", "openai.yaml"),
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

describe("warden:route skill contract", () => {
  test("normalizes project intent and delegates classification to the bundled client", () => {
    expect(ROUTE_SKILL).toContain("name: route");
    expect(ROUTE_SKILL).toContain('argument-hint: "[task description]"');
    expect(ROUTE_SKILL).toContain("scripts/route.mjs");
    expect(ROUTE_SKILL).toContain("explicit|absent|ambiguous");
    expect(ROUTE_SKILL).toContain("regardless of the user's language");
    expect(ROUTE_SKILL).toContain("Do not fall back to repository-only `_shared` files");
  });

  test("reports the kernel classification and closed target contract", () => {
    for (const field of [
      "Workflow",
      "Project intent",
      "Issue identifiers",
      "Target",
      "Diagnostics",
      "Blocked",
    ]) {
      expect(ROUTE_SKILL).toContain(field);
    }

    expect(ROUTE_SKILL).toContain("linear-devotee:create-project");
    expect(ROUTE_SKILL).toContain("linear-devotee:greet");
    expect(ROUTE_SKILL).toContain("direct-task");
  });

  test("keeps routing declarative and ambiguity inert", () => {
    expect(ROUTE_SKILL).toContain("never executes the selected workflow");
    expect(ROUTE_SKILL).toContain("End the skill without invoking it");
    expect(ROUTE_SKILL).toContain("turn `ambiguous` into a routable workflow");
    expect(ROUTE_SKILL).toContain("Write workflow state");
    expect(ROUTE_SKILL).toContain("natural-language phrase dictionary");
  });

  test("publishes matching Codex UI metadata", () => {
    expect(ROUTE_OPENAI).toContain('display_name: "Warden Route"');
    expect(ROUTE_OPENAI).toContain("$warden:route");
  });
});
