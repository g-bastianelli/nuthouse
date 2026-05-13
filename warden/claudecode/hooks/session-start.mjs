#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const FLAG_PATH = path.join(os.homedir(), ".claude", "nuthouse", "voice.state");

// Initialize the flag file to 'on' if it doesn't exist yet.
// This runs once per session — ensures the agent never sees an absent file.
if (!fs.existsSync(FLAG_PATH)) {
  try {
    fs.mkdirSync(path.dirname(FLAG_PATH), { recursive: true });
    fs.writeFileSync(FLAG_PATH, "on", "utf8");
  } catch {
    // Non-fatal — agent defaults to on anyway if read fails.
  }
}
