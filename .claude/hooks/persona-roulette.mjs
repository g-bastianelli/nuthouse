#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export function parseFrontmatter(content) {
  const lines = content.split("\n");
  if (lines[0]?.trim() !== "---") return null;

  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      endIdx = i;
      break;
    }
  }
  if (endIdx === -1) return null;

  const fm = {};
  for (let i = 1; i < endIdx; i++) {
    const line = lines[i];
    const stripped = line.trim();
    if (!stripped || stripped.startsWith("#")) continue;
    const colon = stripped.indexOf(":");
    if (colon === -1) continue;
    const key = stripped.slice(0, colon).trim();
    let value = stripped.slice(colon + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    fm[key] = value;
  }

  const body = lines
    .slice(endIdx + 1)
    .join("\n")
    .trim();
  if (!fm.name || !body) return null;

  return { ...fm, body };
}

export function findPersonas(repoRoot, { stderr = process.stderr } = {}) {
  let entries;
  try {
    entries = fs.readdirSync(repoRoot, { withFileTypes: true });
  } catch {
    return [];
  }

  const personas = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".")) continue;

    const personaPath = path.join(repoRoot, entry.name, "persona.md");
    let content;
    try {
      content = fs.readFileSync(personaPath, "utf8");
    } catch {
      continue;
    }

    const parsed = parseFrontmatter(content);
    if (!parsed) {
      stderr.write(
        `persona-roulette: skipping ${personaPath} (invalid frontmatter or empty body)\n`,
      );
      continue;
    }
    personas.push({ ...parsed, source: personaPath });
  }
  return personas;
}

export function pickPersona(personas, rng = Math.random) {
  if (personas.length === 0) return null;
  const idx = Math.floor(rng() * personas.length);
  return personas[idx];
}

export function buildAdditionalContext(persona) {
  const tagline = persona.tagline ? ` (${persona.tagline})` : "";
  return [
    `<EXTREMELY-IMPORTANT>persona-roulette: today's vibe is **${persona.name}**${tagline}. For this session, your default voice is:`,
    "",
    persona.body,
    "",
    "Apply this voice as the DEFAULT for all replies in this session. Skills that define their own voice (## Voice section pointing to a <plugin>/persona.md) override this voice ONLY WITHIN their execution scope — once a skill finishes (after its final report, or when control returns to the user via a hand-off menu), revert to this default voice for all subsequent interactions. Don't let a skill's voice bleed into the rest of the session.</EXTREMELY-IMPORTANT>",
  ].join("\n");
}

export function main({
  repoRoot,
  env = process.env,
  rng = Math.random,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  if (env.SKILL_ISSUE_PERSONA === "off") return;

  if (!repoRoot) {
    const here = path.dirname(fileURLToPath(import.meta.url));
    repoRoot = path.resolve(here, "..", "..");
  }

  const personas = findPersonas(repoRoot, { stderr });
  if (personas.length === 0) return;

  const picked = pickPersona(personas, rng);
  if (!picked) return;

  const additionalContext = buildAdditionalContext(picked);
  stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext,
      },
    }),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
