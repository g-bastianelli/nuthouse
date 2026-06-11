#!/usr/bin/env node
/**
 * saucy-status state controller.
 *
 * Invoked by the `saucy` skill as:
 *   CLAUDE_PLUGIN_ROOT=... CLAUDE_PLUGIN_DATA=... node state.mjs <arg>
 *
 * <arg> ∈ on | off | saucy | gooning | status | install | uninstall | "" (toggle).
 * Self-contained: node:fs / node:os / node:path only.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function shellQuote(value) {
  return "'" + String(value).replace(/'/g, "'\\''") + "'";
}

export function readMode(flagPath) {
  try {
    return fs.readFileSync(flagPath, "utf8").trim();
  } catch {
    return "off";
  }
}

/** Resolve the next mode for a mode-changing arg. Returns null on unknown arg. */
export function nextMode(arg, current) {
  switch (arg) {
    case "on":
    case "saucy":
      return "saucy";
    case "off":
      return "off";
    case "gooning":
      return "gooning";
    case "":
      return current === "off" ? "saucy" : "off";
    default:
      return null;
  }
}

export function statusLineCommand(pluginRoot, pluginData) {
  const script = path.join(pluginRoot, "hooks", "statusline.sh");
  return `SAUCY_STATUS_ROOT=${shellQuote(pluginRoot)} SAUCY_STATUS_DATA=${shellQuote(
    pluginData,
  )} bash ${shellQuote(script)}`;
}

function readSettings(settingsPath) {
  try {
    return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch {
    return {};
  }
}

function writeSettings(settingsPath, settings) {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

/**
 * Execute one saucy-status command. Pure of process/env concerns: every path
 * is injected. Returns `{ code, message }`; never throws on expected flows.
 */
export function run(arg, { pluginRoot, pluginData, settingsPath }) {
  const flagPath = path.join(pluginData, ".state");
  const current = readMode(flagPath);

  if (arg === "status") {
    return { code: 0, message: `saucy-status: ${current}` };
  }

  if (arg === "install") {
    const settings = readSettings(settingsPath);
    settings.statusLine = {
      type: "command",
      command: statusLineCommand(pluginRoot, pluginData),
    };
    writeSettings(settingsPath, settings);
    return { code: 0, message: "saucy-status installed — restart Claude Code to apply" };
  }

  if (arg === "uninstall") {
    const settings = readSettings(settingsPath);
    const statusCommand = settings.statusLine?.command || "";
    if (
      statusCommand.includes("saucy-status") ||
      statusCommand.includes(path.join(pluginRoot, "hooks", "statusline.sh"))
    ) {
      delete settings.statusLine;
      writeSettings(settingsPath, settings);
    }
    try {
      fs.unlinkSync(flagPath);
    } catch {}
    return { code: 0, message: "saucy-status uninstalled — restart Claude Code to apply" };
  }

  const next = nextMode(arg, current);
  if (next === null) {
    return {
      code: 1,
      message: `unknown arg: ${arg}. Use on|off|gooning|status|install|uninstall`,
    };
  }
  fs.mkdirSync(pluginData, { recursive: true });
  fs.writeFileSync(flagPath, next, "utf8");
  return { code: 0, message: `saucy-status: ${next}` };
}

function main() {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  const pluginData = process.env.CLAUDE_PLUGIN_DATA;
  if (!pluginData) {
    console.error("CLAUDE_PLUGIN_DATA is required for saucy-status state");
    process.exit(1);
  }
  if (!pluginRoot) {
    console.error("CLAUDE_PLUGIN_ROOT is required for saucy-status state");
    process.exit(1);
  }
  const arg = (process.argv[2] || "").trim();
  const settingsPath = path.join(os.homedir(), ".claude", "settings.json");
  const result = run(arg, { pluginRoot, pluginData, settingsPath });
  (result.code === 0 ? console.log : console.error)(result.message);
  process.exit(result.code);
}

// Run only when executed directly (`node .../state.mjs`), not when imported by tests.
if (process.argv[1] && path.basename(process.argv[1]) === "state.mjs") main();
