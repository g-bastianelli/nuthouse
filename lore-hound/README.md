# lore-hound

![lore-hound](./assets/banner.png)

> source-hunting bloodhound / fact-tracker / nose-to-ground truffle-digger

A feral research agent that digs for sources and retrieves facts with zero parametric knowledge.
Web search fan-out → specialized source-fetchers (haiku model, exact citations) → adversarial claim
verification (challenge each fact, prefer recent sources) → synthesis with inline attribution.
The lore-hound's nose stays on the ground. Answers come from fetched sources alone. No training
data, no hallucinations, no unsourced claims — only what the teeth can hold.

## Skills

| Skill      | What it does                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------- |
| `research` | Deep web research with zero parametric knowledge: fan-out search → fetch + verify → cited synthesis |

## Agents

| Agent            | Used by    | Role                                                              |
| ---------------- | ---------- | ----------------------------------------------------------------- |
| `source-fetcher` | `research` | Fetch a URL and extract claims with exact citations (haiku model) |
| `claim-verifier` | `research` | Adversarially verify claims against sources (Sonnet model)        |

## Install

### Claude Code

```
/plugin install lore-hound@nuthouse
```

### Codex CLI

```
codex plugin install lore-hound@nuthouse
```

Codex's native web search is enabled by default; pass `--search` for live fetches.

## License

MIT
