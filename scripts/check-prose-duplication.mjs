#!/usr/bin/env node
// The invariant that replaces the workflow-bundle checkers.
//
// Skill prose is paid on every trigger: a block copied into 27 SKILL.md files is 27
// context loads of the same text, and it is what turned this repo into a four. Length
// is not the problem — duplication is. A 300-line skill whose every line is its own is
// healthy; a 120-line skill with 60 shared lines is not.
//
// This asserts a property, not an inventory: no run of identical prose weighing more
// than BUDGET characters may appear in two different SKILL.md files. Weight, not line
// count, is the measure — the block that made this repo unmaintainable was a single
// 481-character line copied into 27 skills, and the voice-cadence paragraph was 710.
//
// The budget is calibrated on the mandatory cross-runtime header from ADR 0003 — agent
// resolution, the persona pointer, the dynamic-context caveat — which every skill must
// carry and which weighs about 410 characters. That convention stays legal; a block
// materially heavier than it is copied protocol. The rule says nothing about which
// skills exist, so it never needs editing when one is added, renamed, or retired.

import fs from "node:fs";
import path from "node:path";

const BUDGET = 450; // characters of identical prose allowed across two skills
const REPO_ROOT = path.resolve(import.meta.dirname, "..");

function skillFiles(root) {
  const found = [];
  for (const plugin of fs.readdirSync(root, { withFileTypes: true })) {
    if (!plugin.isDirectory() || plugin.name.startsWith(".") || plugin.name.startsWith("_"))
      continue;
    const skillsDir = path.join(root, plugin.name, "skills");
    if (!fs.existsSync(skillsDir)) continue;
    for (const skill of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (!skill.isDirectory()) continue;
      const file = path.join(skillsDir, skill.name, "SKILL.md");
      if (fs.existsSync(file)) found.push(path.relative(root, file));
    }
  }
  return found.sort();
}

// Frontmatter is per-skill metadata, not prose. Structural lines (headings, fences,
// list bullets with no words) carry no duplication signal on their own.
function proseLines(body) {
  const frontmatter = body.match(/^---\n[\s\S]*?\n---\n/);
  const offset = frontmatter ? frontmatter[0].split("\n").length - 1 : 0;
  return body
    .slice(frontmatter ? frontmatter[0].length : 0)
    .split("\n")
    .map((line, index) => ({ text: line.trim().replace(/\s+/g, " "), line: offset + index + 1 }))
    .filter(({ text }) => text.length > 24 && !text.startsWith("#") && !text.startsWith("```"));
}

export function findDuplicatedProse(root) {
  const runs = new Map();
  for (const file of skillFiles(root)) {
    const lines = proseLines(fs.readFileSync(path.join(root, file), "utf8"));
    for (let i = 0; i < lines.length; i++) {
      let weight = 0;
      for (let j = i; j < lines.length; j++) {
        weight += lines[j].text.length;
        if (weight <= BUDGET) continue;
        const key = lines
          .slice(i, j + 1)
          .map((l) => l.text)
          .join("\n");
        if (!runs.has(key)) runs.set(key, []);
        runs.get(key).push({ file, line: lines[i].line, lines: j - i + 1, weight });
        break; // shortest over-budget run starting here is enough to flag it
      }
    }
  }

  const duplicates = [];
  for (const [key, hits] of runs) {
    if (new Set(hits.map((h) => h.file)).size < 2) continue;
    duplicates.push({ excerpt: key.split("\n")[0], weight: hits[0].weight, hits });
  }
  // An over-budget run repeats at every offset inside it. Report the outermost run of
  // each overlapping family: keep a duplicate only when no already-kept one covers the
  // same file pair AND starts at or before it in every file.
  duplicates.sort((a, b) => a.hits[0].line - b.hits[0].line);
  const kept = [];
  for (const d of duplicates) {
    const signature = d.hits.map((h) => h.file).join("|");
    const covered = kept.some(
      (k) =>
        k.hits.map((h) => h.file).join("|") === signature &&
        k.hits.every((h, i) => h.line <= d.hits[i].line && d.hits[i].line < h.line + h.lines),
    );
    if (!covered) kept.push(d);
  }
  return kept;
}

if (import.meta.filename === process.argv[1]) {
  const duplicates = findDuplicatedProse(REPO_ROOT);
  if (duplicates.length === 0) {
    console.log(`No prose block over ${BUDGET} characters is repeated across two SKILL.md files.`);
    process.exit(0);
  }
  console.error(`${duplicates.length} duplicated prose block(s) over ${BUDGET} characters:\n`);
  for (const { excerpt, weight, hits } of duplicates) {
    console.error(
      `  ~${weight} chars — "${excerpt.slice(0, 80)}${excerpt.length > 80 ? "…" : ""}"`,
    );
    for (const hit of hits) console.error(`      ${hit.file}:${hit.line}`);
    console.error("");
  }
  console.error("Move shared prose into one skill's reference/ file, or delete it.");
  process.exit(1);
}
