# Local symptom playbook

Read only the branch matching current evidence. `ROOT_ENV` always comes from
`../../shared/infra-map.md`.

## Missing environment variable

1. Read `apps/atlas/api/src/env.ts` or `apps/atlas/app/src/env.ts` to prove the requirement.
2. Read the root environment source, then the target worktree environment file.
3. Backend files receive only required backend values; the app file receives required `VITE_*`
   values and `VITE_API_URL`.
4. Worktrees do not inherit ignored environment files. Create or edit only the scoped target, then
   rerun validation without printing secrets.

## Service reachability or redirect

Inspect `postgres`, `redis`, `authentik-server`, and `authentik-worker` state. If the requested fix
includes starting missing Authentik services, use the root env file and then poll health; startup
can take roughly a minute. Read the last relevant Authentik logs on failure.

## Known OIDC symptoms

| Symptom                           | Evidence-led hypothesis                           | Next check or fix                                                                     |
| --------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `client_id is missing or invalid` | Fresh Authentik lacks the `atlas-dev` client      | Confirm absence; `moon run db-platform:setup_dev` from the project root may create it |
| `JWKSInvalid`                     | First-load JWKS/cache race or unhealthy Authentik | Check container health and logs; refresh only after service evidence is healthy       |
| `invalid_grant` on refresh        | Stale refresh token                               | Confirm the frontend follows its normal login redirect path                           |

`moon run db-platform:setup_dev` may require interactive project-root context. If this environment
cannot perform it safely, give the exact reason and command to the user.
