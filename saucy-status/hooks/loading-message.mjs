import { createClaudeRuntime } from "../lib/runtime.mjs";

if (!process.env.CLAUDE_PLUGIN_ROOT || !process.env.CLAUDE_PLUGIN_DATA) {
  process.exit(0);
}

const runtime = createClaudeRuntime();
const validModes = new Set(["off", "saucy", "gooning"]);

const raw = runtime.readText(runtime.dataPath(".state"), "").trim();
const mode = validModes.has(raw) ? raw : "off";
if (mode === "off") process.exit(0);

const messages = runtime.readJson(runtime.rootPath("data", "messages.json"), null);
if (!messages) process.exit(0);

const pool = messages[mode] || messages.saucy;
const message = pool[Math.floor(Math.random() * pool.length)];

process.stdout.write(JSON.stringify({ systemMessage: message }));
