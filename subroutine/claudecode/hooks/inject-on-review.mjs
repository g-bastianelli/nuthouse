#!/usr/bin/env node
// subroutine SubagentStart hook (Claude Code; Codex if it honours SubagentStart).
//
// A code-review subagent starts in a fresh context and does NOT inherit the
// parent session's skills, so the discipline would be invisible during review.
// When a review-type subagent spawns, inject the disciplines so the reviewer
// can flag violations. The matcher narrows to review agents; this in-script
// guard double-checks the agent type regardless of matcher semantics.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildInjection, discoverSkills } from "./lib/skills.mjs";

const exit0 = () => process.exit(0);

// Code/diff reviewers that should receive the discipline. Matches `review` only
// at a token boundary (so `preview-generator` is excluded, `git-gremlin:reviewer`
// /`code-reviewer`/`reviewer` are not) plus moon-moth's `change-auditor` (a real
// diff reviewer). Document/plan reviewers like `spec-auditor` / `plan-auditor`
// are deliberately NOT matched — they don't review TypeScript code.
const REVIEW_AGENT = /(?:^|[-_:/])(?:review|change-auditor)/i;

let input;
try {
  input = JSON.parse(fs.readFileSync(0, "utf8"));
} catch {
  exit0();
}

// Field name for the spawning agent's type isn't uniform across runtimes —
// read every plausible carrier so review coverage doesn't silently break.
const agentType = String(
  input?.agent_type ??
    input?.subagent_type ??
    input?.agentType ??
    input?.tool_input?.subagent_type ??
    "",
);
if (!REVIEW_AGENT.test(agentType)) exit0();

const skillsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "skills");
const skills = discoverSkills(skillsDir);
if (!skills.length) exit0();

// Review subagents start blind to the parent transcript, so always inject in
// full (no session dedup) — but buildInjection still guarantees the wrapped
// string stays under the runtime additionalContext cap.
const additionalContext = buildInjection(
  skills,
  "",
  (body) =>
    `<system-reminder>subroutine — TypeScript disciplines that govern the code under review. Flag deviations (the repo's own AGENTS.md overrides where it is stricter):\n${body}</system-reminder>`,
);
if (!additionalContext) exit0();

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SubagentStart",
      additionalContext,
    },
  }),
);
