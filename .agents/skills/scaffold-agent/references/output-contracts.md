# Agent output contracts

Choose one shape and specialize its fields to the agent's purpose.

## SDD brief

Return only the brief, normally under 500 words:

```markdown
## Brief from <agent> — <id>

**Goal:** <one sentence | _unclear_>

**Context**
<why and architecture touched | _unclear_>

**Files referenced**

- `path` — current behavior

**Constraints**

- <explicit or evidenced constraint | _unclear_>

**Acceptance criteria**

- <observable outcome | _unclear_>

**Non-goals**

- <explicit exclusion | _unclear_>

**Edges and ambiguities**

- <conflict or missing decision>

**Questions**

- <most consequential question first>
```

Do not transform an `_unclear_` source field into inferred product intent.

## Structured technical report

Define exact headings and fields; return no prose outside them:

```markdown
## Evidence

- Path: <value | none>
- Observed behavior: <value | _unclear_>

## Findings

- Severity: <critical | warning | note>
- Finding: <evidence-backed statement>

## Unknowns

- <missing evidence or none>
```

Replace these generic fields with domain-specific ones. The caller must be able to consume the
report without guessing whether a sentence is evidence, inference, or recommendation.
