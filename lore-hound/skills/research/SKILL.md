---
name: research
description: Research and fact-check web questions with retrieved evidence and cited synthesis. Use a short direct path for a simple fact and bounded parallel source extraction and verification for broader or disputed questions.
argument-hint: [research-question]
model: sonnet
effort: high
allowed-tools: WebSearch, WebFetch, Read, Agent
---

# research

Resolve `PLUGIN_ROOT` from this skill's `../..` directory. Before subagent dispatch, read
`${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`; outside Claude Code, substitute
the resolved `PLUGIN_ROOT`. Use the active runtime's agent name.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Step 0 — Preconditions

1. Verify the runtime can search and fetch the web using its available native tools.
   Establish today's date from the runtime context and pass it to delegated verification.
   If no web search/fetch capability is available, abort with:
   _"The hunting tools are missing. Enable web search before sending the hound out again."_
2. Use the runtime's native concurrent calls within its tool and available-agent limits.
   Count occupied slots, including the parent when applicable. Dispatch independent jobs
   in bounded waves and release completed workers before filling slots. If capacity is
   unknown, start with one worker; if delegation is unavailable, perform the same bounded
   retrieval and verification directly. A capacity refusal never discards completed evidence.

## Step 1 — Clarify the research question

Treat `$ARGUMENTS` as the research question when non-empty; otherwise take the question
from the user's message. If the question is vague or under-specified (e.g., "what's a good API?" without
budget, language, use case, or region), ask only for missing information that materially
changes the answer. Reuse preferences already supplied and proceed with independent research.

Use retrieved evidence for factual claims. State unresolved gaps as `[NEEDS SOURCE]`.

For a narrow factual question with clear primary evidence, search, fetch, and challenge
the evidence directly, then go to synthesis. Expand to delegated research when coverage,
conflicting sources, or substantial independent reading warrants it. The evidence and
uncertainty rules below apply to both paths.

## Step 2 — Fan-out web search (concurrent execution)

Choose only useful search angles for the question, usually **1–4** initially. Execute
independent searches concurrently within the native tool's batch limit. Possible angles:

- Direct keyword match (e.g., "API for X")
- Semantic variant (e.g., "how to integrate X")
- Recent/news angle when freshness matters (derive the year from today's date)
- Comparison angle (e.g., "X vs Y vs Z")
- Community/stack overflow angle (e.g., "X pitfalls")

Deduplicate URLs and prefer primary sources. Additional searches may target a consequential
gap revealed by fetched evidence; do not rerun successful retrieval merely to change strategy.

## Step 3 — Fetch + summarize (parallel source-fetcher dispatch)

Before dispatching, read
[`references/agent-contracts.md`](references/agent-contracts.md) for the exact
payload and output contract of both research agents.

For promising distinct URLs (normally at most eight), dispatch the logical
`lore-hound:source-fetcher` in waves bounded by currently available slots. Stop fetching
when evidence covers the requested answer; a source budget is a ceiling, not a quota.

Each `source-fetcher` call:

- **Input** (sent as the `prompt`): `url: <URL>` and `question: <the research question>`
- **Output:** the agent returns structured text (JSON per its `## Output format`) — claims
  with exact citations (URL, verbatim excerpt, confidence). Parse it from the agent's final
  message.

Keep the parsed results in context (do not discard the raw claims); if synthesis fails later,
re-reason over the cached claims instead of re-fetching.

## Step 4 — Adversarial verification (parallel claim-verifier dispatch)

Select the **key claims** that matter for the answer (normally at most ten). Deduplicate
equivalent claims and skip trivia. Dispatch the logical `lore-hound:claim-verifier` in
bounded waves; reuse already fetched evidence for claims sharing sources.

Each `claim-verifier` call:

- **Input**: `claim: <the claim>`, `as_of: <today's date>`, and
  `sources: [{ url, excerpt }, ...]`.
- **Output:** the agent returns structured text (JSON per its `## Output format`) — verdict
  `confirmed` / `refuted` / `uncertain`, reasoning, and the decisive source excerpts,
  including sources newly fetched during verification. Parse its final message.

Verifier behavior:

- `confirmed` requires direct reliable support; `refuted` requires evidence of contradiction.
- Missing, inaccessible, ambiguous, or unresolved conflicting evidence is `uncertain`.
- Evaluate authority, relevance, and applicable date together. A newer page is not
  automatically more authoritative; distinguish publication date from the event's date.

## Step 5 — Synthesize with citations

Compose the final report from verified claims only:

- Cite the verifier's decisive sources for each conclusion, including a source it discovered
  itself. Retain exact excerpts as evidence; use inline links and only brief necessary quotes
  in the report, respecting source quotation limits.
- **Unverified points** → mark `[NEEDS SOURCE]` and groan (_"the earth came up empty here,
  boss"_).
- **Never invent.** Never blend training knowledge. Never unsourced speculation.
- **Structure:** plain prose (readable to humans) + citations inline + a 1–2 line voice
  outro from the lore-hound.

Print the report. Exit.

## Final report

For a direct lookup, return the concise cited answer and any unresolved gap. For broader
research, print a summary of findings:

```
lore-hound:research report
  Query:       <clarified user question>
  Sources:     <N found, M fetched, K verified>
  Claims:      <verified count> confirmed, <refuted count> refuted, <uncertain count> uncertain
  Artifact:    <synthesis printed below>

---

<Cited synthesis report>

(grounded in <N> verified sources, <M> gaps marked [NEEDS SOURCE])
```

## Hard rules

- **Never `git commit`, `git push`, or `git rebase`.**
- **Never mutate external services** without explicit user confirmation.
- **Zero parametric knowledge is non-negotiable.** Training data does not count as evidence.
- **Citation is mandatory.** Each factual conclusion must have a supporting URL and retained excerpt.
- **Fail noisy, not silent.** `[NEEDS SOURCE]` is better than invented facts.
- **Bounded concurrency.** Parallelize independent reads within actual capacity; allow
  sequential waves and evidence-driven follow-ups. Stop when the question is covered or
  remaining evidence is unavailable, and report gaps instead of repeating the same searches.
- **Keep report under 2000 words** unless the user explicitly asks for exhaustive coverage.
