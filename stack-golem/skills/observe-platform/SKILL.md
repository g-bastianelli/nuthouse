---
name: observe-platform
description: Investigate notom platform health on Scaleway through direct Loki logs, Prometheus metrics, and resource state instead of delegating evidence collection to Grafana.
argument-hint: [service-or-issue]
effort: high
context: fork
agent: stack-golem:platform-scout
allowed-tools: Read, Bash(scw config get:*), Bash(scw account project list:*), Bash(scw containers container list:*), Bash(scw rdb instance list:*), Bash(scw redis cluster list:*), Bash(scw instance server list:*), Bash(scw cockpit data-source list:*)
---

# observe-platform

Before subagent dispatch, read `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md` and use the
active runtime name. Read `../../persona.md`; it is canonical for user-facing output until the
report.

Investigate with direct evidence before asking the user to inspect a dashboard or run commands.

## Workflow

1. Verify `scw` authentication and the local query tools. Read `../../shared/infra-map.md` for
   endpoints, Loki resource names, SSH aliases, and maintenance notes; never substitute remembered
   infrastructure values.
2. Classify `$ARGUMENTS` or the user report:
   - crash/down → Loki plus Scaleway management state;
   - performance/usage → Prometheus, adding logs when causality is unclear;
   - resource-state uncertainty → Scaleway management state;
   - Authentik host evidence unavailable from telemetry → SSH as a final read-only fallback.
3. For logs, metrics, metric discovery, or SSH, read
   [references/query-cookbook.md](references/query-cookbook.md) and use only the matching section.
4. Loki or Prometheus access uses a newly created temporary cockpit token with only required
   read scopes. Keep its secret in one ephemeral shell variable, never echo it, and arrange token
   deletion before the first query so error paths clean up too.
5. Query the narrowest relevant time range and resource. Correlate telemetry with current
   Scaleway state; distinguish observations, inference, and unknowns.
6. Verify the cockpit token was deleted. If deletion is unconfirmed, report that as the primary
   unresolved operational risk rather than claiming completion.

## Report

```text
stack-golem:observe-platform
  Issue:       <investigated symptom>
  Sources:     <Loki | Prometheus | Scaleway CLI | SSH>
  Findings:    <evidence summary>
  Diagnosis:   <supported cause | unknown>
  Token:       deleted | deletion-unconfirmed | not-created
```

Never commit, push, rebase, store a token, request write scopes, or punt a CLI-queryable question
to Grafana. Grafana is optional visual exploration, not evidence collection by proxy.
