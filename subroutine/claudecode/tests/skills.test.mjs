import { expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildDigest,
  buildDisciplinePayload,
  buildInjection,
  discoverSkills,
  matchSkills,
  parseSkill,
  partitionBySession,
  sweepStaleMarkers,
} from "../hooks/lib/skills.mjs";

const SKILLS_DIR = path.resolve(import.meta.dir, "..", "..", "skills");
const ADDITIONAL_CONTEXT_CAP = 10000;

function tmpMemo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "subroutine-memo-"));
}

test("parseSkill extracts name, description, inline paths, and body", () => {
  const raw = `---
name: type-safety
description: Type-safety discipline — no any.
user-invocable: false
paths: ["**/*.ts", "**/*.tsx"]
---

# body heading

- rule one`;
  const parsed = parseSkill(raw);
  expect(parsed.name).toBe("type-safety");
  expect(parsed.description).toBe("Type-safety discipline — no any.");
  expect(parsed.paths).toEqual(["**/*.ts", "**/*.tsx"]);
  expect(parsed.body.startsWith("# body heading")).toBe(true);
});

test("parseSkill handles block-sequence paths", () => {
  const raw = `---
name: x
paths:
  - "**/*.ts"
  - "src/**/*.tsx"
---
body`;
  expect(parseSkill(raw).paths).toEqual(["**/*.ts", "src/**/*.tsx"]);
});

test("parseSkill returns null without frontmatter", () => {
  expect(parseSkill("no frontmatter here")).toBeNull();
});

test("discoverSkills finds all six real subroutine skills, priority-ordered", () => {
  const skills = discoverSkills(SKILLS_DIR);
  const names = skills.map((s) => s.name);
  expect(names).toEqual([
    "type-safety",
    "validation",
    "code-organisation",
    "result-pattern",
    "react-rules",
    "hono-pipeline",
  ]);
  for (const s of skills) {
    expect(s.body.length).toBeGreaterThan(0);
    expect(s.paths.length).toBeGreaterThan(0);
  }
});

test("discoverSkills returns [] for a missing dir", () => {
  expect(discoverSkills("/no/such/dir/here")).toEqual([]);
});

test("matchSkills: a backend .ts pulls type/validation/org/result/hono (not react)", () => {
  const skills = discoverSkills(SKILLS_DIR);
  const names = matchSkills(skills, "/repo/src/service.ts").map((s) => s.name);
  expect(names).toContain("type-safety");
  expect(names).toContain("validation");
  expect(names).toContain("code-organisation");
  expect(names).toContain("result-pattern");
  expect(names).toContain("hono-pipeline");
  expect(names).not.toContain("react-rules");
});

test("matchSkills: a .tsx pulls react-rules but not the .ts-only domain skills", () => {
  const skills = discoverSkills(SKILLS_DIR);
  const names = matchSkills(skills, "/repo/src/Button.tsx").map((s) => s.name);
  expect(names).toContain("type-safety");
  expect(names).toContain("react-rules");
  expect(names).not.toContain("result-pattern");
  expect(names).not.toContain("hono-pipeline");
});

test("buildDisciplinePayload stays under the additionalContext cap for a backend .ts", () => {
  const skills = discoverSkills(SKILLS_DIR);
  const matched = matchSkills(skills, "/repo/src/service.ts");
  const payload = buildDisciplinePayload(matched);
  expect(payload.length).toBeLessThan(ADDITIONAL_CONTEXT_CAP);
  // Universal rules are present in full; lowest-priority overflow degrades to a summary.
  expect(payload).toContain("### type-safety");
  expect(payload).toContain("also binding (summary only");
});

test("buildDisciplinePayload over ALL skills (review) stays under the cap", () => {
  const skills = discoverSkills(SKILLS_DIR);
  const payload = buildDisciplinePayload(skills);
  expect(payload.length).toBeLessThan(ADDITIONAL_CONTEXT_CAP);
  expect(payload).toContain("### type-safety");
});

test("buildDisciplinePayload packs everything in full when under budget", () => {
  const skills = discoverSkills(SKILLS_DIR).slice(0, 2);
  const payload = buildDisciplinePayload(skills, { capChars: 9000 });
  expect(payload).not.toContain("also binding");
  expect(payload).toContain("### type-safety");
  expect(payload).toContain("### validation");
});

test("buildDigest is one compact line per skill", () => {
  const skills = discoverSkills(SKILLS_DIR);
  const digest = buildDigest(skills);
  const lines = digest.split("\n");
  expect(lines.length).toBe(skills.length);
  expect(lines[0]).toContain("`type-safety`");
  expect(digest.length).toBeLessThan(2000);
});

test("empty skill set yields empty payload", () => {
  expect(buildDisciplinePayload([])).toBe("");
});

test("parseSkill block-sequence paths skips blank lines and comments, stops at next key", () => {
  const raw = `---
name: x
paths:
  - "**/*.ts"
  # a comment

  - "**/*.tsx"
user-invocable: false
---
body`;
  expect(parseSkill(raw).paths).toEqual(["**/*.ts", "**/*.tsx"]);
});

test("buildDisciplinePayload demotes a strict priority suffix", () => {
  const skills = discoverSkills(SKILLS_DIR);
  const payload = buildDisciplinePayload(skills, { capChars: 6000 });
  const fullIdx = [];
  const summaryIdx = [];
  skills.forEach((s, i) => {
    if (payload.includes(`### ${s.name}\n`)) fullIdx.push(i);
    else summaryIdx.push(i);
  });
  expect(fullIdx.length).toBeGreaterThan(0);
  expect(summaryIdx.length).toBeGreaterThan(0);
  // Every full skill is higher priority (lower index) than every summarized one.
  expect(Math.max(...fullIdx)).toBeLessThan(Math.min(...summaryIdx));
});

test("buildDisciplinePayload output never exceeds capChars (overflow summary counted)", () => {
  const skills = discoverSkills(SKILLS_DIR);
  for (const cap of [3000, 4000, 6000, 8000, 9500]) {
    expect(buildDisciplinePayload(skills, { capChars: cap }).length).toBeLessThanOrEqual(cap);
  }
});

test("a .tsx packs react-rules as a full body under a realistic hook budget", () => {
  const matched = matchSkills(discoverSkills(SKILLS_DIR), "/repo/src/Button.tsx");
  const payload = buildDisciplinePayload(matched, { capChars: 9748 });
  expect(payload).toContain("### react-rules");
  expect(payload).not.toContain("also binding");
});

test("partitionBySession marks skills seen across calls within a session", () => {
  const dir = tmpMemo();
  const skills = discoverSkills(SKILLS_DIR);
  try {
    const first = partitionBySession(skills, "sess-1", dir);
    expect(first.fresh.length).toBe(skills.length);
    expect(first.seen.length).toBe(0);
    const second = partitionBySession(skills, "sess-1", dir);
    expect(second.fresh.length).toBe(0);
    expect(second.seen.length).toBe(skills.length);
    // A different session is independent.
    expect(partitionBySession(skills, "sess-2", dir).fresh.length).toBe(skills.length);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("partitionBySession treats everything fresh with no sessionId (review path)", () => {
  const skills = discoverSkills(SKILLS_DIR);
  const r = partitionBySession(skills, "");
  expect(r.fresh.length).toBe(skills.length);
  expect(r.seen.length).toBe(0);
});

test("buildInjection: full bodies first time, reminder on repeat, both under the cap", () => {
  const dir = tmpMemo();
  const skills = discoverSkills(SKILLS_DIR);
  const wrap = (b) => `<system-reminder>x:\n${b}</system-reminder>`;
  try {
    const first = buildInjection(skills, "s1", wrap, { memoDir: dir });
    expect(first).toContain("### type-safety");
    expect(first.length).toBeLessThan(ADDITIONAL_CONTEXT_CAP);
    const second = buildInjection(skills, "s1", wrap, { memoDir: dir });
    expect(second).toContain("Still binding (loaded earlier this session)");
    expect(second).not.toContain("### type-safety");
    expect(second.length).toBeLessThan(first.length);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("buildInjection guarantees the wrapped string stays under RUNTIME_CAP even with a fat envelope", () => {
  const skills = discoverSkills(SKILLS_DIR);
  const wrap = (b) => `<system-reminder>${"PADDING ".repeat(30)}\n${b}</system-reminder>`;
  const out = buildInjection(skills, "", wrap); // sessionId "" → all full, no memo writes
  expect(out.length).toBeLessThan(ADDITIONAL_CONTEXT_CAP);
  expect(out).toContain("### type-safety");
});

test("sweepStaleMarkers reaps markers older than the TTL, keeps recent ones", () => {
  const dir = tmpMemo();
  try {
    const stale = path.join(dir, "stale");
    const recent = path.join(dir, "recent");
    fs.writeFileSync(stale, "");
    fs.writeFileSync(recent, "");
    const now = 1_700_000_000_000;
    const ttl = 24 * 60 * 60 * 1000;
    const old = new Date(now - 3 * ttl);
    fs.utimesSync(stale, old, old);
    const justNow = new Date(now - 60_000);
    fs.utimesSync(recent, justNow, justNow);
    sweepStaleMarkers(dir, ttl, now);
    expect(fs.existsSync(stale)).toBe(false);
    expect(fs.existsSync(recent)).toBe(true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("partitionBySession sweeps stale markers when it writes fresh ones", () => {
  const dir = tmpMemo();
  try {
    fs.mkdirSync(dir, { recursive: true });
    const ancient = path.join(dir, "ancient");
    fs.writeFileSync(ancient, "");
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    fs.utimesSync(ancient, old, old);
    // fresh skills → triggers the write+sweep path
    partitionBySession(discoverSkills(SKILLS_DIR), "sweep-sess", dir);
    expect(fs.existsSync(ancient)).toBe(false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("partitionBySession does NOT scan/write on a pure repeat (dedup path stays cheap)", () => {
  const dir = tmpMemo();
  try {
    const skills = discoverSkills(SKILLS_DIR);
    partitionBySession(skills, "repeat-sess", dir); // first: writes markers
    // Drop a stale marker AFTER the first write; a pure repeat must not sweep it.
    const ancient = path.join(dir, "ancient");
    fs.writeFileSync(ancient, "");
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    fs.utimesSync(ancient, old, old);
    const repeat = partitionBySession(skills, "repeat-sess", dir); // all seen → no write/sweep
    expect(repeat.fresh.length).toBe(0);
    expect(fs.existsSync(ancient)).toBe(true); // sweep did not run
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
