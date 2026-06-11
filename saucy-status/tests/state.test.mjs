import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { nextMode, run, shellQuote, statusLineCommand } from "../scripts/state.mjs";

let tmp;
let pluginRoot;
let pluginData;
let settingsPath;

function opts() {
  return { pluginRoot, pluginData, settingsPath };
}

function flagPath() {
  return path.join(pluginData, ".state");
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "saucy-state-test-"));
  pluginRoot = path.join(tmp, "plugin");
  pluginData = path.join(tmp, "data");
  settingsPath = path.join(tmp, "home", ".claude", "settings.json");
  fs.mkdirSync(pluginRoot, { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("nextMode", () => {
  test("maps explicit args", () => {
    expect(nextMode("on", "off")).toBe("saucy");
    expect(nextMode("saucy", "off")).toBe("saucy");
    expect(nextMode("off", "gooning")).toBe("off");
    expect(nextMode("gooning", "off")).toBe("gooning");
  });

  test("empty arg toggles off ↔ saucy", () => {
    expect(nextMode("", "off")).toBe("saucy");
    expect(nextMode("", "saucy")).toBe("off");
    expect(nextMode("", "gooning")).toBe("off");
  });

  test("unknown arg returns null", () => {
    expect(nextMode("banana", "off")).toBeNull();
  });
});

describe("run — mode writes", () => {
  test("writes the flag file and reports the new mode", () => {
    const result = run("gooning", opts());
    expect(result.code).toBe(0);
    expect(result.message).toBe("saucy-status: gooning");
    expect(fs.readFileSync(flagPath(), "utf8")).toBe("gooning");
  });

  test("toggle flips from existing state without an arg", () => {
    run("on", opts());
    const result = run("", opts());
    expect(result.message).toBe("saucy-status: off");
    expect(fs.readFileSync(flagPath(), "utf8")).toBe("off");
  });

  test("status reports without writing", () => {
    const result = run("status", opts());
    expect(result.code).toBe(0);
    expect(result.message).toBe("saucy-status: off");
    expect(fs.existsSync(flagPath())).toBe(false);
  });

  test("unknown arg fails with code 1 and writes nothing", () => {
    const result = run("banana", opts());
    expect(result.code).toBe(1);
    expect(result.message).toContain("unknown arg: banana");
    expect(fs.existsSync(flagPath())).toBe(false);
  });
});

describe("run — install / uninstall", () => {
  test("install writes statusLine pointing at the plugin statusline.sh", () => {
    const result = run("install", opts());
    expect(result.code).toBe(0);
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    expect(settings.statusLine.type).toBe("command");
    expect(settings.statusLine.command).toContain(path.join(pluginRoot, "hooks", "statusline.sh"));
    expect(settings.statusLine.command).toContain("SAUCY_STATUS_DATA=");
  });

  test("install preserves unrelated settings keys", () => {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify({ theme: "dark" }), "utf8");
    run("install", opts());
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    expect(settings.theme).toBe("dark");
    expect(settings.statusLine).toBeDefined();
  });

  test("uninstall removes our statusLine and the flag file", () => {
    run("install", opts());
    run("on", opts());
    const result = run("uninstall", opts());
    expect(result.code).toBe(0);
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    expect(settings.statusLine).toBeUndefined();
    expect(fs.existsSync(flagPath())).toBe(false);
  });

  test("uninstall leaves a foreign statusLine untouched", () => {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({ statusLine: { type: "command", command: "other-statusline" } }),
      "utf8",
    );
    run("uninstall", opts());
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    expect(settings.statusLine.command).toBe("other-statusline");
  });
});

describe("statusLineCommand / shellQuote", () => {
  test("single-quotes values and escapes embedded quotes", () => {
    expect(shellQuote("a'b")).toBe("'a'\\''b'");
  });

  test("command embeds quoted root and data paths", () => {
    const cmd = statusLineCommand("/r o/ot", "/da'ta");
    expect(cmd).toContain("SAUCY_STATUS_ROOT='/r o/ot'");
    expect(cmd).toContain("SAUCY_STATUS_DATA='/da'\\''ta'");
    expect(cmd).toContain("bash '/r o/ot/hooks/statusline.sh'");
  });
});
