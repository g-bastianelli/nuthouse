# stack-golem — infra map

Single source of truth for machine-specific paths, SSH aliases, endpoints, and
resource names used by stack-golem skills and agents. Skills reference these
keys instead of inlining values — update a value here and every skill follows.

| Key                       | Purpose                                                         | Value                                                                           |
| ------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `ROOT_ENV`                | notom-platform root `.env` (source of truth for local env vars) | `/Users/gbastianelli/.superset/projects/notom-platform/.env`                    |
| `INSOMNIA_GIT_DIR`        | Insomnia Git Sync repos on disk (macOS)                         | `~/Library/Application Support/Insomnia/version-control/git/`                   |
| `LOKI_ENDPOINT`           | Cockpit Loki logs API                                           | `https://c11ce546-873d-43e2-ae57-a18117f89e4e.logs.cockpit.fr-par.scw.cloud`    |
| `PROM_ENDPOINT`           | Cockpit Prometheus metrics API                                  | `https://d8d4c40d-5d0e-4702-8c75-d4e3a70e6f6b.metrics.cockpit.fr-par.scw.cloud` |
| `GRAFANA_DASHBOARDS`      | Cockpit Grafana dashboards (visual exploration only)            | `https://0ff77eb4-546c-48bf-b5d0e-f16585298484.dashboard.cockpit.scaleway.com`  |
| `SSH_AUTHENTIK_STAGING`   | SSH alias — Authentik staging VM (DEV1-S, IP `163.172.165.162`) | `notom-authentik-staging`                                                       |
| `SSH_AUTHENTIK_PROD`      | SSH alias — Authentik prod VM (GP1-XS, IP `212.47.250.52`)      | `notom-authentik-prod`                                                          |
| `SSH_AGENT_SOCK`          | Bitwarden SSH agent socket (`IdentityAgent` in `~/.ssh/config`) | `~/.bitwarden-ssh-agent.sock`                                                   |
| `LOKI_RESOURCE_ATLAS_API` | Loki `resource_name` — Atlas API serverless container (staging) | `notomapistagingc842d7f8-atlas-api-staging`                                     |
| `LOKI_RESOURCE_POSTGRES`  | Loki `resource_name` — PostgreSQL (staging)                     | `notom-db-staging`                                                              |
| `LOKI_RESOURCE_REDIS`     | Loki `resource_name` — Redis (staging)                          | `notom-redis-staging`                                                           |
| `LOKI_RESOURCE_APP`       | Loki `resource_name` — App CDN/S3 (staging)                     | `notom-app-staging`                                                             |

## Maintenance

If an Authentik IP changes (instance rebuild), refresh it and update this table:

```bash
scw instance server list -o json | jq -r '.[] | select(.name|startswith("notom-authentik")) | "\(.name)\t\(.public_ip.address)"'
```

Both SSH aliases live in `~/.ssh/config` (`User root`, auth via the Bitwarden SSH
agent at `SSH_AGENT_SOCK`). Check the agent with `ssh-add -l` (look for
`Notom Prod` / `Notom Staging - SSH provisioning key`). `Permission denied
(publickey)` usually means the agent is locked, not a config problem.
