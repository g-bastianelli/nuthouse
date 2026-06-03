---
name: debug-local
description: Use when the user reports a runtime error, a service not starting, an auth/OIDC failure, or missing env vars in local dev on the notom platform. Investigate proactively with available tools before asking the user to run anything.
---

# debug-local

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

Use this skill when the user reports a local dev problem on the notom platform:
runtime error, service not starting, auth/OIDC failure, missing env vars.

**Core principle: investigate first, ask later.** Never tell the user to run a
command you can run yourself. Read `.env` files, run `docker compose ps`, and
check logs yourself before reporting.

## Step 0 — Preconditions

1. Verify you are inside a notom-platform worktree or the main project (presence of `docker-compose.yml` at the worktree root).
2. Verify `docker` / `docker compose` is available.

## Step 1 — Classify the symptom

Inspect what the user reported and route:

- **Env var missing** → Step 2a
- **Service not reachable / auth redirect failing** → Step 2b
- **Auth/OIDC error** (`client_id missing`, `JWKSInvalid`, `invalid_grant`) → Step 2c

## Step 2a — Missing env var (e.g. `VITE_API_URL`, `AUTHENTIK_ISSUER_URL`)

1. Read `apps/atlas/api/src/env.ts` or `apps/atlas/app/src/env.ts` to see what's required.
2. Read `/Users/gbastianelli/.superset/projects/notom-platform/.env` (root, source of truth) for the values.
3. Write the missing `.env` file:
   - API `.env` (`apps/atlas/api/.env`) gets backend vars copied from root `.env`.
   - App `.env` (`apps/atlas/app/.env`) gets only `VITE_*` vars + `VITE_API_URL`.

> Worktrees don't inherit `.env` from the main project — create them explicitly.

## Step 2b — Service not reachable / auth redirect failing

1. `docker compose ps` — check which containers are up and healthy.
   Services: `postgres`, `redis`, `authentik-server`, `authentik-worker`.
2. If Authentik missing:
   ```bash
   docker compose --env-file /Users/gbastianelli/.superset/projects/notom-platform/.env up -d authentik-server authentik-worker
   ```
   Authentik takes ~60s to start. Re-check with `docker compose ps`.
3. `docker compose logs --tail=30 authentik-server authentik-worker` — check for crashes.

## Step 2c — Auth / OIDC failures

| Symptom                                 | Diagnosis                                                   | Fix                                                                                   |
| --------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `client_id is missing or invalid`       | Authentik is fresh — `atlas-dev` OAuth client doesn't exist | `moon run db-platform:setup_dev` from the **project root** (NOT the worktree)         |
| `JWKSInvalid` / token validation failed | Race on first load — JWKS cache not warm                    | Hard-refresh the page; if it persists, check Authentik health via `docker compose ps` |
| `invalid_grant` on refresh              | Old refresh token from a previous session                   | Normal — frontend redirects to login automatically                                    |

## Step 3 — Fix or instruct

Apply the fix yourself when possible (write `.env`, start containers). Only instruct
the user for actions you genuinely cannot perform (e.g. clicking in the browser,
running `moon run db-platform:setup_dev` which requires interactive context).

## Infrastructure map (reference)

| What                          | Where                                                         |
| ----------------------------- | ------------------------------------------------------------- |
| Docker Compose                | `docker-compose.yml` at worktree root                         |
| Root `.env` (source of truth) | `/Users/gbastianelli/.superset/projects/notom-platform/.env`  |
| API `.env`                    | `apps/atlas/api/.env` — copy vars from root `.env`            |
| App `.env`                    | `apps/atlas/app/.env` — only `VITE_*` vars + `VITE_API_URL`   |
| Authentik setup               | `moon run db-platform:setup_dev` — creates `atlas-dev` client |

## Final report

```
stack-golem:debug-local report
  Symptom:      <classified symptom>
  Investigated: <docker compose ps / .env reads / logs checked>
  Root cause:   <diagnosis>
  Action:       <what was fixed / what the user must do>
```

## Hard rules

- **Always run `docker compose ps` yourself** before reporting container status.
- **Always read `.env` files yourself** before saying they're missing.
- **Check logs yourself** (`docker compose logs`) before asking the user.
- Never `git commit`, `git push`, or `git rebase`.
- Worktrees don't inherit `.env` — create them explicitly.
