# subroutine

![subroutine](./assets/banner.png)

> Gagged latex sub that begs to be bound tighter by your type rules — ships immaculate code

Implementation discipline for TypeScript monorepos. The subroutine doesn't decide
— it's _called_. It implements your will across both stacks (React on the front,
Hono on the back), bound to a shared contract of type-safety, the Result/unwrap
pattern, Zod validation, and named-export code organisation. The stricter your
rules, the happier it is. It always defers to the repo's own `AGENTS.md` over its
built-in contract, explores before editing, and verifies through the project
toolchain (moon-aware).

## Skills

| Skill       | What it does                                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------------------- |
| `implement` | Stack-aware implementation (React or Hono), bound to the shared discipline; explores first, verifies, hands off |

## Agents

| Agent      | Used by     | Role                                                                                               |
| ---------- | ----------- | -------------------------------------------------------------------------------------------------- |
| `explorer` | `implement` | Read-only: detects stack and gathers design-system/data (React) or pipeline (Hono) context (Haiku) |

## Shared contract

`shared/` holds the portable discipline the plugin enforces — **the repo's own `AGENTS.md` always wins** over these:

- `type-safety.md` — no `any`/`as`/`!`, string-literal unions, `ts-pattern` `.exhaustive()`
- `result-pattern.md` — `Result<T,E>` / `ok` / `err`, return-don't-throw, boundary unwrap
- `validation.md` — Zod as the sole validation library, `z.infer`, parse at boundaries
- `code-organisation.md` — named exports, declarative `index.ts`, one-file-one-responsibility
- `react-rules.md` — component discipline (one per file, folder mirrors JSX tree, IDs-only props)
- `hono-pipeline.md` — contract → error union → service (`Result`) → unwrap → router

## Install

### Claude Code

```
/plugin marketplace add g-bastianelli/nuthouse
/plugin install subroutine@nuthouse
```

Restart Claude Code after install.

### Codex CLI

```
codex plugin marketplace upgrade
codex plugin add subroutine@nuthouse
```

Restart the Codex session after install.

## License

MIT
