# Research agent contracts

Read this before the fetch and verification dispatches. Both steps use one concurrent
batch through the runtime's native delegation mechanism; do not dispatch sequentially.
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
      "confidence": "<confidence>"
    }
  ],
  "_unclear_": []
}
```

The agent is fetch-optimized and must not fill source gaps from memory.

## `lore-hound:claim-verifier`

Purpose: test one load-bearing claim against the supplied evidence, preferring recent
reliable sources and defaulting to `refuted` when uncertainty cannot be resolved.

Input prompt:

```text
claim: <claim>
sources: [{ "url": "<URL>", "excerpt": "<verbatim excerpt>" }]
```

Expected final-message JSON:

```json
{ "verdict": "confirmed | refuted | uncertain", "reasoning": "<evidence-based reason>" }
```

Parse the structured final message. Preserve the extracted claims in context so a later
synthesis failure can be retried without refetching the sources.
