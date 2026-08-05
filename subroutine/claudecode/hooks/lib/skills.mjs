// Discover subroutine's discipline skills and turn them into the text a hook
// injects as `additionalContext`. The SKILL.md files remain the single source
// of truth — this lib only reads, matches, and packs them under the runtime's
// 10 000-char additionalContext budget.

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { matchGlob } from "./glob.mjs";

// Injection priority: universal rules first, then React (so `use*.ts` hooks do
// not lose their applicable discipline), then backend-specific rules. When the
// bodies exceed the budget, a lowest-priority suffix degrades to summaries.
// Unknown skills sort last, alphabetically.
const PRIORITY = [
  "type-safety",
  "validation",
  "code-organisation",
  "react-rules",
  "testing-discipline",
  "state-machine",
  "result-pattern",
  "hono-pipeline",
];

// Hard ceiling the runtime enforces on a single additionalContext string.
export const RUNTIME_CAP = 10000;

// Default body budget when a caller doesn't pass one (used by unit tests and
// direct callers). Real hooks pass a precise budget via buildInjection so the
// full wrapped string is guaranteed under RUNTIME_CAP.
const DEFAULT_CAP = 9500;

// Per-session injection memo: empty marker files keyed by (session, skill) so a
// discipline body is injected in full at most once per session. Override the
// directory with SUBROUTINE_MEMO_DIR (used by tests). Best-effort — any fs
// error degrades to "always fresh" (full injection), never throws.
const MEMO_DIR = process.env.SUBROUTINE_MEMO_DIR || path.join(os.tmpdir(), "subroutine-inject");

// Markers untouched for longer than this are dead-session leftovers and get
// reaped, so the memo dir can't grow without bound. An active session re-touches
// its fresh markers on each new skill-set, keeping them well under the TTL.
const MEMO_TTL_MS = 24 * 60 * 60 * 1000;

function stripQuotes(s) {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function fieldString(frontmatter, key) {
  const m = frontmatter.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, "m"));
  return m ? stripQuotes(m[1]) : undefined;
}

function fieldList(frontmatter, key) {
  const lines = frontmatter.split("\n");
  const idx = lines.findIndex((l) => new RegExp(`^${key}:`).test(l));
  if (idx === -1) return [];
  const head = lines[idx].slice(lines[idx].indexOf(":") + 1).trim();
  if (head.startsWith("[")) {
    // Inline flow sequence, e.g. ["**/*.ts", "**/*.tsx"] — valid JSON here.
    try {
      const arr = JSON.parse(head);
      if (Array.isArray(arr)) return arr.map(String);
    } catch {
      // ignore — fall through to permissive split
    }
    return head
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map((s) => stripQuotes(s))
      .filter(Boolean);
  }
  // Block sequence: subsequent `  - item` lines. Skip blank lines and `#`
  // comments (both legal mid-list in YAML); stop at the next key (a non-blank,
  // non-comment line that isn't a `- ` item).
  const out = [];
  for (let i = idx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*$/.test(line) || /^\s*#/.test(line)) continue;
    const mm = line.match(/^\s*-\s*(.+?)\s*$/);
    if (!mm) break;
    out.push(stripQuotes(mm[1]));
  }
  return out;
}

/** Parse a SKILL.md string into { name, description, paths, body } or null. */
export function parseSkill(raw) {
  const m = String(raw).match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  return {
    name: fieldString(m[1], "name"),
    description: fieldString(m[1], "description"),
    paths: fieldList(m[1], "paths"),
    body: m[2].trim(),
  };
}

function byPriority(a, b) {
  const ia = PRIORITY.indexOf(a.name);
  const ib = PRIORITY.indexOf(b.name);
  const ra = ia === -1 ? PRIORITY.length : ia;
  const rb = ib === -1 ? PRIORITY.length : ib;
  if (ra !== rb) return ra - rb;
  return String(a.name).localeCompare(String(b.name));
}

/** Read every `<skillsDir>/<name>/SKILL.md`, return parsed skills in priority order. */
export function discoverSkills(skillsDir) {
  let entries;
  try {
    entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const skills = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    let raw;
    try {
      raw = fs.readFileSync(path.join(skillsDir, entry.name, "SKILL.md"), "utf8");
    } catch {
      continue;
    }
    const parsed = parseSkill(raw);
    if (!parsed || !parsed.body) continue;
    skills.push({
      name: parsed.name || entry.name,
      description: parsed.description || "",
      paths: parsed.paths || [],
      body: parsed.body,
    });
  }
  return skills.sort(byPriority);
}

/** Skills whose `paths` globs match the given file path. */
export function matchSkills(skills, filePath) {
  const p = String(filePath || "");
  if (!p) return [];
  return skills.filter((s) => s.paths.some((g) => matchGlob(g, p)));
}

function assemblePayload(full, overflow) {
  let out = full.map((s) => `\n### ${s.name}\n${s.body}\n`).join("");
  if (overflow.length) {
    const lines = overflow.map((s) => `- \`${s.name}\` — ${s.description}`).join("\n");
    out += `\n### also binding (summary only, omitted for length)\n${lines}\n`;
  }
  return out.trim();
}

/**
 * Pack skills into one string: full bodies in priority order, and once the
 * ASSEMBLED output (bodies + overflow summary) would exceed `capChars`, the
 * lowest-priority skills degrade to a one-line summary. Because the summary is
 * counted, the returned string is guaranteed <= capChars — except the degenerate
 * case where even an all-summary list overruns, which this discipline set never
 * hits. Demotion is a strict priority suffix: if a skill overflows, every
 * lower-priority one does too.
 */
function packDisciplinePayload(skills, { capChars = DEFAULT_CAP } = {}) {
  if (!skills.length) return { payload: "", full: [], overflow: [] };
  const full = [...skills];
  const overflow = [];
  for (;;) {
    const out = assemblePayload(full, overflow);
    if (out.length <= capChars || full.length === 0) {
      return { payload: out, full, overflow };
    }
    overflow.unshift(full.pop());
  }
}

export function buildDisciplinePayload(skills, opts) {
  return packDisciplinePayload(skills, opts).payload;
}

/** Compact one-line-per-skill digest for SessionStart. */
export function buildDigest(skills) {
  return skills.map((s) => `- \`${s.name}\` — ${s.description}`).join("\n");
}

function markerPath(memoDir, sessionId, skillName) {
  const key = crypto
    .createHash("sha1")
    .update(`${sessionId}\0${skillName}`)
    .digest("hex")
    .slice(0, 20);
  return path.join(memoDir, key);
}

/**
 * Delete marker files in `memoDir` whose mtime is older than `ttlMs`, bounding
 * the memo dir's growth to roughly one TTL window of active sessions. Touches
 * only subroutine's own marker dir and never throws.
 */
export function sweepStaleMarkers(memoDir, ttlMs = MEMO_TTL_MS, now = Date.now()) {
  let names;
  try {
    names = fs.readdirSync(memoDir);
  } catch {
    return;
  }
  for (const name of names) {
    const p = path.join(memoDir, name);
    try {
      if (now - fs.statSync(p).mtimeMs > ttlMs) fs.rmSync(p, { force: true });
    } catch {}
  }
}

/**
 * Split `skills` into the ones not yet injected this session (`fresh`) and the
 * ones already injected (`seen`). Marking happens only after budget packing,
 * because a summarized overflow discipline has not yet been delivered in full.
 * With no `sessionId` (e.g. review subagents, which start blind to the parent
 * transcript), everything is `fresh`. Any fs error treats the skill as fresh.
 */
export function partitionBySession(skills, sessionId, memoDir = MEMO_DIR) {
  if (!sessionId) return { fresh: skills, seen: [] };
  const fresh = [];
  const seen = [];
  for (const s of skills) {
    let exists = false;
    try {
      exists = fs.existsSync(markerPath(memoDir, sessionId, s.name));
    } catch {
      exists = false;
    }
    (exists ? seen : fresh).push(s);
  }
  return { fresh, seen };
}

/** Mark only skill bodies that were actually emitted in full. Best-effort. */
export function markSkillsSeen(skills, sessionId, memoDir = MEMO_DIR) {
  if (!sessionId || !skills.length) return;
  try {
    fs.mkdirSync(memoDir, { recursive: true });
    sweepStaleMarkers(memoDir);
    for (const s of skills) {
      try {
        fs.writeFileSync(markerPath(memoDir, sessionId, s.name), "");
      } catch {}
    }
  } catch {
    // A memo failure must never block discipline delivery.
  }
}

/**
 * Build the full wrapped additionalContext for a hook. Injects full bodies for
 * skills not yet seen this session and a one-line reminder for those already
 * loaded, then wraps with `wrap(body)`. The body budget is derived from the
 * wrapper overhead and the reminder length so the returned string is guaranteed
 * under RUNTIME_CAP. Returns "" when there is nothing to say.
 */
export function buildInjection(skills, sessionId, wrap, opts = {}) {
  const { memoDir = MEMO_DIR, cap = RUNTIME_CAP, margin = 120 } = opts;
  if (!skills.length) return "";
  const { fresh, seen } = partitionBySession(skills, sessionId, memoDir);
  if (!fresh.length && !seen.length) return "";
  const seenLine = seen.length
    ? `Still binding (loaded earlier this session): ${seen.map((s) => `\`${s.name}\``).join(", ")}.`
    : "";
  const overhead = wrap("").length;
  const budget = Math.max(0, cap - margin - overhead - seenLine.length - 2);
  const packed = packDisciplinePayload(fresh, { capChars: budget });
  const core = [packed.payload, seenLine].filter(Boolean).join("\n\n");
  if (!core) return "";
  const injection = wrap(core);
  markSkillsSeen(packed.full, sessionId, memoDir);
  return injection;
}
