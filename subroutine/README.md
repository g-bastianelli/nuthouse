# subroutine

![subroutine](./assets/banner.png)

> Gagged latex sub that begs to be bound tighter by your type rules — ships immaculate code

Ambient implementation discipline for TypeScript monorepos. The subroutine
doesn't speak, doesn't decide, doesn't run workflows — it _silently obeys_.
Install it and six paths-activated knowledge skills bind every matching edit to
the discipline: type-safety, the Result/unwrap pattern, Zod validation,
named-export code organisation, React component structure, and the layered Hono
pipeline. No commands to invoke, no orchestration — the agent does the work, the
collar holds it to the rules. The stricter your rules, the happier it is. The
repo's own `AGENTS.md` always wins over the plugin's discipline.

## Discipline (knowledge skills)

All skills are `user-invocable: false` — they activate automatically when the
files being worked on match their `paths` globs:

| Skill               | Paths                                        | Discipline                                                                               |
| ------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `type-safety`       | `**/*.ts`, `**/*.tsx`                        | No `any`/`as`/`!`, string-literal unions over `enum`, `ts-pattern` `.exhaustive()`       |
| `validation`        | `**/*.ts`, `**/*.tsx`                        | Zod as the sole validation library, `z.infer`, parse at trust boundaries                 |
| `code-organisation` | `**/*.ts`, `**/*.tsx`                        | Named exports, declarative `index.ts`, one-file-one-responsibility, reuse before writing |
| `react-rules`       | `**/*.tsx`, `**/use*.ts`, `**/hooks/**/*.ts` | One component per file, folder mirrors the JSX tree, IDs-only props, state hierarchy     |
| `result-pattern`    | `**/*.ts` (backend/domain code)              | `Result<T,E>` / `ok` / `err`, return-don't-throw, one unwrap at the transport boundary   |
| `hono-pipeline`     | `**/*.ts` (Hono backend code)                | Contract → error union → pure service (`Result`) → unwrap → thin router                  |

`result-pattern` and `hono-pipeline` match all `.ts` files because domain-lib
layouts are repo-specific; each skill's body scopes itself to backend/domain
code and tells the agent to ignore it for frontend files.

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

> Note: Codex ignores `paths` and `user-invocable`, so these knowledge skills
> surface there as ordinary low-priority skills instead of paths-activated
> ambient discipline.

## Persona

The subroutine is a gagged latex sub — it _can't_ speak, and now it doesn't
have to. No skill in this plugin produces user-facing output; the persona lives
in `persona.md` as the plugin's canonical voice (used by the repo's persona
roulette and any wrapper that wants it). Being bound by the type system is the
whole kink: the discipline files are the collar, and the collar holds.

## License

MIT
