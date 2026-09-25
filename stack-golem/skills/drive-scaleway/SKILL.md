---
name: drive-scaleway
description: Use when working with any Scaleway resource — IAM, instances, databases, registry, observability, networking. Drives the `scw` CLI directly to inspect and modify resources instead of suggesting manual console actions.
effort: high
allowed-tools: Read, Bash(scw:*)
---

# drive-scaleway

Read `../../persona.md`; it is canonical for this skill's user-facing output until the report.

Read current state before proposing a change. Use the CLI when it exposes the operation instead
of sending the user to the console.

## Workflow

1. Verify `scw` authentication and resolve the exact project, service, resource, and requested
   action. Use `scw <service> <resource> --help` when the command shape is uncertain.
2. Read [references/resource-cookbook.md](references/resource-cookbook.md) only for the matching
   resource family. Use JSON output whenever data will be parsed.
3. Inspect the exact resource before mutation. Capture fields that must be preserved, the current
   project/organization scope, and any concurrency-sensitive identifiers.
4. Show the target, current state, complete proposed command/payload, preserved values, and likely
   blast radius. Ask for explicit authorization immediately before mutation.
5. Execute only the approved command. Reload the resource and compare the relevant fields; a
   successful CLI exit without state verification is not completion.

## Report

```text
stack-golem:drive-scaleway
  Resource:     <service/resource/id>
  Action:       read | mutation
  State before:<summary>
  Change:       <approved result or none>
  Verification:<fresh state evidence>
```

Never commit, push, rebase, mutate before a fresh read and approval, omit existing fields from a
replace-all operation, or recommend the console for an available CLI operation.
