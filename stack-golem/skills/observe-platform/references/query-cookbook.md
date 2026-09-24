# Platform query cookbook

Read only the section selected by the investigation. Replace every uppercase infrastructure key
with the current value from `../../shared/infra-map.md`.

## Temporary cockpit token

Create with `scw cockpit token create`, requesting only `read_only_logs` and/or
`read_only_metrics`. Parse `secret_key` and `id` from JSON without printing the secret. Install a
shell cleanup trap that deletes the exact token id, then explicitly delete and verify cleanup at
the end.

## Loki

- Endpoint: `LOKI_ENDPOINT`; header: `X-Token`; API: `/loki/api/v1/`.
- Select the service through its `LOKI_RESOURCE_*` key.
- Query `/query_range` with nanosecond `start`/`end`, `direction=backward`, and a small limit.
- Parse JSON lines defensively; retain timestamps and the original line when `message` is absent.
- Discover uncertainty with `/labels` and `/label/resource_name/values` rather than guessing.

On macOS, `date -v-30M`; on GNU systems, use the supported equivalent after checking `date`.

## Prometheus

- Endpoint: `PROM_ENDPOINT`; header: `X-Token`; API: `/prometheus/api/v1/`.
- Discover names through `/label/__name__/values` before inventing a metric.
- Useful prefixes: `instance_server_*`, `rdb_instance_postgresql_*`, `rkv_cluster_*`,
  `serverless_container_*`, `object_storage_bucket_*`, `edge_content_delivery_service_*`, and
  `vpc_pn_*`.
- Common health evidence includes container CPU/memory/instances, PostgreSQL activity, Redis
  used/max memory, and VM agent/memory ratios. Confirm exact names from discovery.

## Scaleway management plane

Use JSON output and project fields from the infra map:

```bash
scw containers container list -o json
scw rdb instance list -o json
scw redis cluster list -o json
scw instance server list -o json
scw cockpit data-source list -o json
```

Project only fields needed for the diagnosis; avoid dumping secrets or full configurations.

## Authentik SSH fallback

Use `SSH_AUTHENTIK_STAGING` or `SSH_AUTHENTIK_PROD` only when telemetry is insufficient. Start
with read-only Docker, journald, disk, and memory inspection. The infra map's Maintenance section
owns SSH-agent troubleshooting and rebuilt-instance IP refresh.

## Grafana

Use `GRAFANA_DASHBOARDS` for optional visual exploration. If data sources are missing, inspect
them first; `scw cockpit grafana sync-data-sources` is a mutation and requires user authorization.
