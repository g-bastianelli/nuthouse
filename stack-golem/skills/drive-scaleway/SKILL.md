---
name: drive-scaleway
description: Use when working with any Scaleway resource — IAM, instances, databases, registry, observability, networking. Drives the `scw` CLI directly to inspect and modify resources instead of suggesting manual console actions.
allowed-tools: Read
---

# drive-scaleway

## Voice

Read `../../persona.md` at the start of this skill. That persona is
canonical for all output of this skill. Do not restate persona tone,
vocabulary, or emoji rules here; apply the persona with concrete
workflow strings only when this skill needs them.

**Scope:** local to this skill's execution only. Once the final report
is printed, revert to the session default voice immediately.
Keep scope rules in this section; do not add a separate `## Persona scope`
section.

This skill is **rigid** — execute steps in order.

## Language

Adapt all output to match the user's language. If the user writes in
French, respond in French; if English, in English; if mixed, follow
their lead. Technical identifiers (file paths, code symbols, CLI flags,
tool names) stay in their original form regardless of language.

## When you're invoked

Use this skill when working with any Scaleway resource: IAM, instance, rdb, redis,
registry, observability, network. Inspecting current state, updating resources,
or debugging infra failures (Pulumi errors, permission issues).

**Core principle: read before you write.** Always inspect current state with
`scw ... get` or `scw ... list` before proposing changes. **Never** suggest "go to
the Scaleway console" for something `scw` can do.

## Step 0 — Preconditions

1. Verify `scw` CLI is available and authenticated (`scw account project list -o json`).
2. For any mutation: confirm the target resource and project with the user first.

## Step 1 — Discover the resource & action

```bash
scw <service> --help                   # list resources
scw <service> <resource> --help        # list actions
scw <service> <resource> list --help   # list filters & flags
```

Always add `-o json` when piping to `jq`:

```bash
scw ... -o json | jq '.field'
```

## Step 2 — Read current state

Inspect before mutating. Common reads:

### IAM

```bash
scw iam application list name=my-app -o json
scw iam policy list application-ids.0=<app-id> -o json
scw iam policy get <policy-id> -o json
scw iam permission-set list -o json | jq '[.[] | select(.name | test("Observ"; "i"))]'
```

### Databases

```bash
scw rdb instance list -o json
scw rdb instance get <id> -o json
scw rdb database list instance-id=<id> -o json
```

### Instances

```bash
scw instance server list -o json
scw instance server get <id> -o json
```

### Registry

```bash
scw registry namespace list -o json
scw registry image list namespace-id=<id> -o json
```

### Observability

```bash
scw cockpit get -o json    # Grafana URL, endpoints
```

## Step 3 — Mutate (only after reading + user confirmation)

### IAM rule update (overwrites ALL rules)

```bash
scw iam rule update <policy-id> \
  rules.0.permission-set-names.0=ExistingPermission \
  rules.0.permission-set-names.1=NewPermission \
  rules.0.project-ids.0=<project-id>
```

> `scw iam rule update` overwrites ALL rules. **Always fetch current rules first
> (`scw iam policy get`) and include them.**
>
> **Scope types are not mixable in a single rule.** Check with
> `scw iam permission-set list -o json | jq '.[] | {name, scope_type}'` —
> `projects`-scoped and `organization`-scoped permission sets must go in separate
> rules. Use `rules.1.organization-id=<org-id>` for organization-scoped ones.

## Common mistakes

| Mistake                                                   | Fix                                                                              |
| --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Suggesting console for IAM policy edits                   | Use `scw iam rule update`                                                        |
| Forgetting existing rules in `rule update`                | Fetch with `scw iam policy get` first, reconstruct all rules                     |
| Using `scw iam policy update` for rule changes            | That only updates metadata — use `scw iam rule update`                           |
| Not using `-o json` when parsing output                   | Always add `-o json` when piping to `jq`                                         |
| `IAMApplicationManager` alone for creating policies       | Also add `IAMPolicyManager` — separate permission sets                           |
| `getGrafana`/cockpit data source panic (provider v1.45.0) | Pass `projectId` explicitly — provider panics on `projects[0]` when inferring it |

## Final report

```
stack-golem:drive-scaleway report
  Resource:     <service/resource>
  Action:       <read / mutation>
  State before: <summary>
  Change:       <what was applied, if any>
```

## Hard rules

- **Read before write** — always inspect current state before mutating.
- **Confirm mutations with the user** before applying — IAM rule updates overwrite all rules.
- Never `git commit`, `git push`, or `git rebase`.
- Never suggest the Scaleway console for an operation `scw` can perform.
- Always add `-o json` when parsing output.
