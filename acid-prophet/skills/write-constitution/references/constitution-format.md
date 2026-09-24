# Constitution artifact format

Read this immediately before drafting.

```markdown
---
id: constitution
status: ratified
last-reviewed: <today ISO>
version: <positive integer>
---

# Constitution — <project name>

> Articles below are enforced by the independent spec auditor on every spec audit.
> A violation produces `gate:constitution:<slug>` BLOCKER and
> `handoff-eligible: no`.

## Articles

### <article-slug>

**Rule.** <one sentence stating what a spec must or must not do>

**Why.** <one to three sentences citing repository or incident evidence>

**Scope.** <when the rule applies and the explicit exit/anti-scope>

**Auditor check.** <observable evidence the auditor uses to decide pass/fail>
```

Every article heading is an ASCII kebab-case slug of at most 30 characters. The slug is
stable because the auditor embeds it in `[gate:constitution:<slug>]` findings.
