# Research agent contracts

Read this before the fetch and verification dispatches. Use concurrent waves bounded by
the runtime's available slots. Completed results survive capacity failures and follow-ups.
Resolve both logical agent names through
`${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`; outside Claude Code, use the same
path under the resolved `PLUGIN_ROOT`.

## `lore-hound:source-fetcher`

Purpose: fetch one URL and extract question-relevant claims with exact provenance.

Input prompt:

```text
url: <URL>
question: <research question>
```

Expected final-message JSON:

```json
{
  "claims": [
    {
      "text": "<claim>",
      "citation_url": "<URL>",
      "citation_excerpt": "<verbatim excerpt>",
      "confidence": <number from 0.0 to 1.0>
    }
  ],
  "_unclear_": ["<uncovered part>"]
}
```

Use an empty array when the fetched page fully covers the question. Otherwise, include one
concise string for each uncovered part.

The agent is fetch-optimized and must not fill source gaps from memory.

## `lore-hound:claim-verifier`

Purpose: test one load-bearing claim against retrieved evidence. Require direct support
for `confirmed`, direct contradiction for `refuted`, and return `uncertain` for gaps or
unresolved conflicts. Judge source authority, relevance, and applicable date together.

Input prompt:

```text
claim: <claim>
as_of: <today's YYYY-MM-DD date>
sources: [{ "url": "<URL>", "excerpt": "<verbatim excerpt>" }]
```

Expected final-message JSON:

```json
{
  "verdict": "confirmed | refuted | uncertain",
  "reasoning": "<evidence-based reason>",
  "sources": [
    { "url": "<decisive fetched URL>", "excerpt": "<exact supporting or contradicting excerpt>" }
  ]
}
```

Include newly fetched evidence, not just the input sources. `confirmed` and `refuted`
require at least one decisive source; an unsuccessful search can return `uncertain` with
an empty source list. A missing proof is never a contradiction. Preserve the final sources
alongside the extracted claims so synthesis can cite the actual evidence without refetching.
