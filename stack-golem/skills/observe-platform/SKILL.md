---
name: observe-platform
description: Use when investigating a service issue, checking logs, querying metrics, or verifying the health of any notom-platform resource on Scaleway staging or prod. Queries Loki logs and Prometheus metrics directly via the cockpit API — never punts to Grafana.
argument-hint: [service-or-issue]
context: fork
agent: stack-golem:platform-scout
allowed-tools: Read, Bash(scw config get:*), Bash(scw account project list:*), Bash(scw containers container list:*), Bash(scw rdb instance list:*), Bash(scw redis cluster list:*), Bash(scw instance server list:*), Bash(scw cockpit data-source list:*)
---

# observe-platform

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

Use this skill to investigate a service issue, check logs, query metrics, or verify
the health of any notom-platform resource on Scaleway staging or prod.

**Core principle: investigate first, ask later.** All tools are available via CLI —
never ask the user to open Grafana for something you can query yourself.

## Step 0 — Preconditions

1. Verify `scw` CLI is available and authenticated (`scw config get` or `scw account project list`).
2. Verify `curl` and `python3` are available (used to query Loki/Prometheus).

## Step 1 — Classify the issue

Start from `$ARGUMENTS` (a service name or issue description) when non-empty;
otherwise classify from the user's report.

- **Service down / crash?** → query Loki logs (Step 3) + Scaleway CLI state (Step 5)
- **Performance / usage?** → query Prometheus metrics (Step 4)
- **Resource state unclear?** → Scaleway CLI state (Step 5)

## Step 2 — Create a temporary cockpit token (REQUIRED for Loki & Prometheus)

The cockpit token secret is only returned at creation — never stored. Always create
a temporary token, query, then delete.

```bash
# 1. Create
TOKEN_JSON=$(scw cockpit token create name=tmp-query \
  token-scopes.0=read_only_logs \
  token-scopes.1=read_only_metrics \
  -o json)
TOKEN=$(echo $TOKEN_JSON | python3 -c "import json,sys; print(json.loads(sys.stdin.read())['secret_key'])")
TOKEN_ID=$(echo $TOKEN_JSON | python3 -c "import json,sys; print(json.loads(sys.stdin.read())['id'])")

# 2. Query (Steps 3 / 4)

# 3. Delete (ALWAYS — even on error)
scw cockpit token delete $TOKEN_ID
```

Use only the scopes you need: `read_only_logs`, `read_only_metrics`, `write_only_logs`, `write_only_metrics`.

## Step 3 — Loki (logs)

**Endpoint:** `https://c11ce546-873d-43e2-ae57-a18117f89e4e.logs.cockpit.fr-par.scw.cloud`
**Auth header:** `X-Token: $TOKEN` · **API path:** `/loki/api/v1/`

### Service → resource_name mapping

| Service                          | resource_name                               |
| -------------------------------- | ------------------------------------------- |
| Atlas API (serverless container) | `notomapistagingc842d7f8-atlas-api-staging` |
| PostgreSQL                       | `notom-db-staging`                          |
| Redis                            | `notom-redis-staging`                       |
| App (CDN/S3)                     | `notom-app-staging`                         |

### Query last N minutes

```bash
LOKI="https://c11ce546-873d-43e2-ae57-a18117f89e4e.logs.cockpit.fr-par.scw.cloud"
START=$(date -v-30M +%s)000000000
END=$(date +%s)000000000

curl -sG -H "X-Token: $TOKEN" \
  --data-urlencode 'query={resource_name="notomapistagingc842d7f8-atlas-api-staging"}' \
  --data "limit=50&start=$START&end=$END&direction=backward" \
  "$LOKI/loki/api/v1/query_range" | python3 -c "
import json, sys, datetime
for stream in json.loads(sys.stdin.read()).get('data',{}).get('result',[]):
    for ts, line in stream.get('values',[]):
        t = datetime.datetime.fromtimestamp(int(ts)//1_000_000_000)
        try: msg = json.loads(line).get('message', line)
        except: msg = line
        print(f'[{t}] {msg[:200]}')
"
```

### Discover labels

```bash
curl -s -H "X-Token: $TOKEN" "$LOKI/loki/api/v1/labels"
curl -s -H "X-Token: $TOKEN" "$LOKI/loki/api/v1/label/resource_name/values"
```

## Step 4 — Prometheus (metrics)

**Endpoint:** `https://d8d4c40d-5d0e-4702-8c75-d4e3a70e6f6b.metrics.cockpit.fr-par.scw.cloud`
**Auth header:** `X-Token: $TOKEN` · **API path:** `/prometheus/api/v1/`

### Metric families by service

| Service             | Metric prefix                     |
| ------------------- | --------------------------------- |
| VM Authentik        | `instance_server_*`               |
| PostgreSQL          | `rdb_instance_postgresql_*`       |
| Redis               | `rkv_cluster_*`                   |
| Atlas API container | `serverless_container_*`          |
| App S3 bucket       | `object_storage_bucket_*`         |
| CDN (Edge Services) | `edge_content_delivery_service_*` |
| Private network     | `vpc_pn_*`                        |

### Query a metric

```bash
PROM="https://d8d4c40d-5d0e-4702-8c75-d4e3a70e6f6b.metrics.cockpit.fr-par.scw.cloud"

# Instant query
curl -sG -H "X-Token: $TOKEN" \
  --data-urlencode 'query=serverless_container_requests_per_second' \
  "$PROM/prometheus/api/v1/query" | python3 -c "
import json,sys
for r in json.loads(sys.stdin.read()).get('data',{}).get('result',[]):
    print(r.get('metric'), '->', r.get('value'))
"

# Discover all metric names
curl -s -H "X-Token: $TOKEN" "$PROM/prometheus/api/v1/label/__name__/values"
```

### Key health metrics

```bash
serverless_container_cpu_usage_ratio                                          # Container CPU (0–1)
serverless_container_memory_usage_bytes / serverless_container_memory_limit_bytes  # Container memory
serverless_container_instances_total                                          # Container scaling
rdb_instance_postgresql_pg_stat_activity_count                                # PostgreSQL connections
rkv_cluster_redis_memory_used_bytes / rkv_cluster_redis_memory_max_bytes      # Redis memory
instance_server_agent_up                                                      # VM health
instance_server_memory_used / instance_server_memory_total                    # VM memory
```

## Step 5 — Scaleway CLI (management plane — no token needed)

```bash
scw containers container list -o json | jq '[.[] | {name, status, min_scale, max_scale}]'  # Container status & scaling
scw rdb instance list -o json | jq '[.[] | {name, status, node_type}]'                     # PostgreSQL health
scw redis cluster list -o json | jq '[.[] | {name, status, node_type}]'                    # Redis health
scw instance server list -o json | jq '[.[] | {name, state, public_ip}]'                   # VM (Authentik) health
scw cockpit data-source list -o json | jq '[.[] | {name, type, synchronized_with_grafana}]'  # Cockpit datasources
```

## Step 6 — SSH into Authentik VMs (when logs/metrics aren't enough)

The Authentik instances are plain Scaleway VMs (Ubuntu 24.04). SSH in as `root` to
inspect docker, journald, or disk directly.

| Host alias                | IP                | Scaleway instance                  |
| ------------------------- | ----------------- | ---------------------------------- |
| `notom-authentik-staging` | `163.172.165.162` | `notom-authentik-staging` (DEV1-S) |
| `notom-authentik-prod`    | `212.47.250.52`   | `notom-authentik-prod` (GP1-XS)    |

```bash
ssh notom-authentik-staging 'docker ps'
ssh notom-authentik-prod 'journalctl -u docker --since "1 hour ago"'
```

Both aliases live in `~/.ssh/config` (`User root`, auth via Bitwarden SSH agent
`IdentityAgent ~/.bitwarden-ssh-agent.sock`). Check the agent with `ssh-add -l`
(look for `Notom Prod` / `Notom Staging - SSH provisioning key`). `Permission denied
(publickey)` usually means the agent is locked, not a config problem.

If an IP changes (instance rebuild), refresh it with:

```bash
scw instance server list -o json | jq -r '.[] | select(.name|startswith("notom-authentik")) | "\(.name)\t\(.public_ip.address)"'
```

## Grafana (visual exploration only)

Dashboards: `https://0ff77eb4-546c-48bf-b5d0e-f16585298484.dashboard.cockpit.scaleway.com`
If datasources appear empty: `scw cockpit grafana sync-data-sources`

## Final report

```
stack-golem:observe-platform report
  Issue:        <what was investigated>
  Source:       <Loki / Prometheus / Scaleway CLI / SSH>
  Findings:     <logs / metrics summary>
  Diagnosis:    <root cause or status>
  Token:        deleted ✓
```

## Hard rules

- **Always delete the temporary cockpit token** after querying — even on error paths.
- **Use only the scopes you need** when creating tokens.
- Never `git commit`, `git push`, or `git rebase`.
- Never punt to Grafana for something queryable via CLI/API.
- Never store or echo the token secret beyond the ephemeral shell variable.
