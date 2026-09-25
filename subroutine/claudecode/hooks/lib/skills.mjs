// Discover subroutine's discipline skills and turn them into the text a hook
// injects as `additionalContext`. The SKILL.md files remain the single source
// of truth — this lib only reads, matches, and packs them under the runtime's
// 10 000-char additionalContext budget.

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { matchGlob } from "./glob.mjs";

// Injection priority: universal rules first, then the narrow file-scoped ones
// (a skill that only matches forms is the reason this file was opened, and it
// would not be re-delivered by the next edit), then React, then backend rules.
// When the bodies exceed the budget, a lowest-priority suffix degrades to
// summaries. Unknown skills sort last, alphabetically.
const PRIORITY = [
  "type-safety",
  "validation",
  "code-organisation",
  "form-rules",
  "react-rules",
  "testing-discipline",
  "state-machine",
  "result-pattern",
  "hono-pipeline",
];

// Hard ceiling the runtime enforces on a single additionalContext string.
export const RUNTIME_CAP = 10000;

// Headroom buildInjection keeps below `cap` by default.
export const INJECTION_MARGIN = 120;

// Default body budget when a caller doesn't pass one (used by unit tests and
// direct callers). Real hooks pass a precise budget via buildInjection so the
// full wrapped string is guaranteed under RUNTIME_CAP.
const DEFAULT_CAP = 9500;

// Per-session injection memo: one directory per session holding empty marker
// files keyed by (agent, skill), so a discipline body is injected in full at
// most once per context. A subagent reports its parent's session id with its own
// agent id, so it gets its own markers. A compaction reports the parent's
// session id even when a subagent compacts, so clearing the session directory
// resets the parent and its subagents together. Override the
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

/** Skills whose `paths` globs match at least one of the file paths, in priority order. */
export function matchSkills(skills, filePaths) {
  const paths = filePaths.map((p) => String(p || "")).filter(Boolean);
  return skills.filter((s) => s.paths.some((g) => paths.some((p) => matchGlob(g, p))));
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

function shortHash(value) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 20);
}

function sessionMemoDir(memoDir, sessionId) {
  return path.join(memoDir, shortHash(sessionId));
}

function markerPath(memoDir, sessionId, agentId, skillName) {
  return path.join(sessionMemoDir(memoDir, sessionId), shortHash(`${agentId}\0${skillName}`));
}

/** The session id both runtimes put in every hook input. */
export function sessionIdOf(input) {
  return String(input?.session_id ?? "");
}

/** Forget every discipline delivered in this session, subagents included. */
export function clearSessionMemo(sessionId, memoDir = MEMO_DIR) {
  if (!sessionId) return;
  try {
    fs.rmSync(sessionMemoDir(memoDir, sessionId), { recursive: true, force: true });
  } catch {}
}

/**
 * Delete marker files older than `ttlMs`, in `memoDir` and in its session
 * directories, then drop stale session directories left empty. A fresh empty
 * directory may belong to a hook that has not written its markers yet. Bounds
 * the memo dir to roughly one TTL window of active sessions. Touches only
 * subroutine's own marker dir and never throws.
 */
export function sweepStaleMarkers(memoDir, ttlMs = MEMO_TTL_MS, now = Date.now()) {
  for (const p of listEntries(memoDir)) {
    try {
      if (!fs.statSync(p).isDirectory()) {
        removeIfStale(p, ttlMs, now);
        continue;
      }
      // Removing markers bumps the directory's mtime, so read its age first.
      const dirStale = isStale(p, ttlMs, now);
      const markers = listEntries(p);
      const removed = markers.filter((marker) => removeIfStale(marker, ttlMs, now)).length;
      if (dirStale && removed === markers.length) fs.rmdirSync(p);
    } catch {}
  }
}

function listEntries(dir) {
  try {
    return fs.readdirSync(dir).map((name) => path.join(dir, name));
  } catch {
    return [];
  }
}

function isStale(file, ttlMs, now) {
  return now - fs.statSync(file).mtimeMs > ttlMs;
}

function removeIfStale(file, ttlMs, now) {
  try {
    if (!isStale(file, ttlMs, now)) return false;
    fs.rmSync(file, { force: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Split `skills` into the ones not yet injected this session (`fresh`) and the
 * ones already injected (`seen`). Marking happens only after budget packing,
 * because a summarized overflow discipline has not yet been delivered in full.
 * With no `sessionId`, everything is `fresh`. Any fs error treats the skill as
 * fresh.
 */
export function partitionBySession(skills, sessionId, memoDir = MEMO_DIR, agentId = "") {
  if (!sessionId) return { fresh: skills, seen: [] };
  const fresh = [];
  const seen = [];
  for (const s of skills) {
    let exists = false;
    try {
      exists = fs.existsSync(markerPath(memoDir, sessionId, agentId, s.name));
    } catch {
      exists = false;
    }
    (exists ? seen : fresh).push(s);
  }
  return { fresh, seen };
}

/** Mark only skill bodies that were actually emitted in full. Best-effort. */
export function markSkillsSeen(skills, sessionId, memoDir = MEMO_DIR, agentId = "") {
  if (!sessionId || !skills.length) return;
  try {
    sweepStaleMarkers(memoDir);
    fs.mkdirSync(sessionMemoDir(memoDir, sessionId), { recursive: true });
    for (const s of skills) {
      try {
        fs.writeFileSync(markerPath(memoDir, sessionId, agentId, s.name), "");
      } catch {}
    }
  } catch {
    // A memo failure must never block discipline delivery.
  }
}

/**
 * Wrap for PostToolUse injections. Bodies are pasted without their file path,
 * so the envelope names the skills directory for routed `references/` links.
 */
export function disciplineEnvelope(skillsDir) {
  return (body) =>
    `<system-reminder>subroutine — discipline bound to this file (the repo's own AGENTS.md overrides where it is stricter). Relative links resolve under ${skillsDir}/<skill>/:\n${body}</system-reminder>`;
}

/**
 * Build the full wrapped additionalContext for a hook. Injects full bodies for
 * skills not yet seen this session and a one-line reminder for those already
 * loaded, then wraps with `wrap(body)`. The body budget is derived from the
 * wrapper overhead and the reminder length so the returned string is guaranteed
 * under RUNTIME_CAP. Returns "" when there is nothing to say.
 */
export function buildInjection(skills, sessionId, wrap, opts = {}) {
  const { memoDir = MEMO_DIR, agentId = "", cap = RUNTIME_CAP, margin = INJECTION_MARGIN } = opts;
  if (!skills.length) return "";
  const { fresh, seen } = partitionBySession(skills, sessionId, memoDir, agentId);
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
  markSkillsSeen(packed.full, sessionId, memoDir, agentId);
  return injection;
}
