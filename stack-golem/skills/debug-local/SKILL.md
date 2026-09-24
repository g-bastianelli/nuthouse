---
name: debug-local
description: Diagnose notom local-development runtime, startup, auth/OIDC, and environment failures using available evidence before asking the user to run anything.
argument-hint: [symptom-description]
effort: high
allowed-tools: Read, Edit, Glob, Grep, Bash(docker compose ps:*), Bash(docker compose logs:*), Bash(docker compose up:*), Bash(docker compose restart:*), Agent
---

# debug-local

Read `../../persona.md`; it is canonical for this skill's user-facing output until the report.

Investigate locally available evidence before giving the user instructions.

## Workflow

1. Verify a notom-platform root through `docker-compose.yml`, confirm Docker Compose is available,
   and read `../../shared/infra-map.md` for machine-specific paths such as `ROOT_ENV`.
2. Start from `$ARGUMENTS` or the user symptom. Run `docker compose ps` yourself, inspect relevant
   environment schemas/files, and read narrow service logs before classifying the cause.
3. For missing variables, reachability, Authentik startup, or known OIDC symptoms, read
   [references/symptom-playbook.md](references/symptom-playbook.md) and apply only the matching
   branch. Do not treat a table match as proof without current evidence.
4. Apply an in-scope local fix when authorized and verifiable. Ask the user only for actions the
   current environment genuinely cannot perform.
5. Re-run the observation that originally failed. Report a hypothesis as unresolved until fresh
   runtime evidence confirms it.

## Report

```text
stack-golem:debug-local
  Symptom:      <classified symptom>
  Investigated:<files, state, and logs>
  Root cause:   <supported cause | unresolved>
  Action:       <fix applied or user action>
  Verification:<fresh evidence>
```

Never commit, push, rebase, claim an environment value without reading it, or ask the user to run
a command available to this skill.
