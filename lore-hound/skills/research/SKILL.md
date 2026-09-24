---
name: research
description: Research and fact-check web questions through parallel search, source extraction, adversarial verification, and cited synthesis without relying on model memory.
argument-hint: [research-question]
model: sonnet
effort: high
allowed-tools: WebSearch, WebFetch, Read, Agent
---

# research

> Agent resolution: before any subagent dispatch, read `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md` and use the active runtime's name.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Context

> Auto-injected on Claude Code at skill load. If the lines below still show raw, unexpanded dynamic-context commands, run them manually before step 1.

- Today: !`date +%Y-%m-%d`

## Step 0 — Preconditions

1. Verify the runtime can search and fetch the web. On Claude Code that's the `WebSearch` +
   `WebFetch` tools; on Codex it's the native web search tool (enabled by default — pass
   `--search` for live fetches). If no web search/fetch capability is available, abort with:
   _"les outils de chasse ne sont pas là. active la recherche web avant de relancer."_
2. Parallelism is achieved by issuing multiple tool calls in a single message (concurrent
   `WebSearch` calls, then concurrent `Agent` dispatches) — no special orchestration tool is
   required.

## Step 1 — Clarify the research question

Treat `$ARGUMENTS` as the research question when non-empty; otherwise take the question
from the user's message. If the question is vague or under-specified (e.g., "what's a good API?" without
budget, language, use case, or region), ask **2–3 clarifying questions** before starting
the hunt. Keep them tight and specific.

Once clarified, state the hound's opening rule aloud:

> **Zero parametric knowledge.** I will answer using ONLY fetched + verified sources.
> No training data, no guesses. Every claim comes with a citation. If nothing's fetched,
> I'll mark it `[NEEDS SOURCE]` and groan about the gap — no invention.

## Step 2 — Fan-out web search (concurrent execution)

Generate **3–5 search angles** based on the clarified question. Execute them in parallel
via `WebSearch` (do NOT loop sequentially). Angles should be:

- Direct keyword match (e.g., "API for X")
- Semantic variant (e.g., "how to integrate X")
- Recent/news angle (e.g., "X <current year> news" — derive the year from `Today` in the
  `## Context` block)
- Comparison angle (e.g., "X vs Y vs Z")
- Community/stack overflow angle (e.g., "X pitfalls")

Collect all results and URLs.

## Step 3 — Fetch + summarize (parallel source-fetcher dispatch)

Before dispatching, read
[`references/agent-contracts.md`](references/agent-contracts.md) for the exact
payload and output contract of both research agents.

For each promising source URL from Step 2 (cap at ~8 sources per run), dispatch the
logical `lore-hound:source-fetcher` agent **in parallel** — issue all agent calls in one
batch, do not fetch sequentially.

Each `source-fetcher` call:

- **Input** (sent as the `prompt`): `url: <URL>` and `question: <the research question>`
- **Output:** the agent returns structured text (JSON per its `## Output format`) — claims
  with exact citations (URL, verbatim excerpt, confidence). Parse it from the agent's final
  message.

Keep the parsed results in context (do not discard the raw claims); if synthesis fails later,
re-reason over the cached claims instead of re-fetching.

## Step 4 — Adversarial verification (parallel claim-verifier dispatch)

Select the **key claims** that matter for the answer (cap at ~10 claims per run — prioritize
the load-bearing ones, skip trivia). Dispatch the logical `lore-hound:claim-verifier` agent
**in parallel** — all agent calls in one batch.

Each `claim-verifier` call:

- **Input** (sent as the `prompt`): `claim: <the claim>` and `sources: [{ url, excerpt }, ...]`
- **Output:** the agent returns structured text (JSON per its `## Output format`) — verdict
  `confirmed` / `refuted` / `uncertain` + reasoning. Parse it from the agent's final message.

Verifier behavior:

- Tense when recent and reliable sources back the claim → `confirmed`. Judge source
  freshness against `Today` from the `## Context` block — never against the model's
  training-data sense of "now".
- Hostile: if stale sources or contradictions exist, prefer the recent/reliable source.
- Default to `refuted` if uncertain — the hound doesn't guess.

## Step 5 — Synthesize with citations

Compose the final report from verified claims only:

- **Each claim** → exact citation (URL + excerpt).
- **Unverified points** → mark `[NEEDS SOURCE]` and groan (_"the earth came up empty here,
  boss"_).
- **Never invent.** Never blend training knowledge. Never unsourced speculation.
- **Structure:** plain prose (readable to humans) + citations inline + a 1–2 line voice
  outro from the lore-hound.

Print the report. Exit.

## Final report

Print a summary of findings:

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
- **Citation is mandatory.** Every claim must have a URL + excerpt.
- **Fail noisy, not silent.** `[NEEDS SOURCE]` is better than invented facts.
- **Parallel execution only.** WebSearch and subagent dispatches must run concurrently, never
  in sequential observe→act loops.
- **Keep report under 2000 words** unless the user explicitly asks for exhaustive coverage.
