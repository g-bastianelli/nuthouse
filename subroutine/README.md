# subroutine

![subroutine](./assets/banner.png)

> Gagged latex sub that begs to be bound tighter by your type rules — ships immaculate code

Ambient implementation discipline for TypeScript monorepos. The subroutine
doesn't speak, doesn't decide, doesn't run workflows — it _silently obeys_.
Install it and a hook binds the discipline to your work: type-safety, the
Result/unwrap pattern, Zod validation, named-export code organisation, React
component structure, behavioral testing, explicit state machines, and the
layered Hono pipeline. No commands to invoke, no orchestration — the agent does
the work, the collar holds it to the rules. The stricter your rules, the happier
it is. The repo's own `AGENTS.md` always wins over the plugin's discipline.

## How it binds

The discipline lives in eight `SKILL.md` files, but it is **delivered by a hook**,
not by hoping the model invokes a skill. Model-driven skill invocation is
unreliable for passive knowledge, and subagents don't inherit the parent
session's skills at all — so a hook is the only mechanism that loads the rules
deterministically, during both implementation and review:

| Hook event      | Matcher                  | What it does                                                                                                                        |
| --------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `PostToolUse`   | `Edit\|Write\|MultiEdit` | Reads the edited file path, matches it against each skill's `paths`, injects the matching discipline bodies as `additionalContext`. |
| `SubagentStart` | `review`                 | A code-review subagent starts blind to the parent's skills — this injects the disciplines so the reviewer can flag violations.      |
| `SessionStart`  | `startup\|resume`        | In a TypeScript repo, injects a one-line-per-discipline digest so the spine is present before the first edit.                       |

Bodies use focused, reusable examples and are packed under the runtime's 10 000-
char `additionalContext` budget. A normal backend `.ts` or component `.tsx`
receives every relevant discipline in full. When a cross-stack hook or review
matches too many, the lowest-priority overflow degrades to a one-line summary.
The `SKILL.md` files remain the single source of truth — edit them, and the hook
delivers the change.

## Discipline (the eight rule sets)

Each discipline matches files by its `paths` globs:

| Skill                | Paths                                        | Discipline                                                                               |
| -------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `type-safety`        | `**/*.ts`, `**/*.tsx`                        | No `any`/`as`/`!`, string-literal unions over `enum`, `ts-pattern` `.exhaustive()`       |
| `validation`         | `**/*.ts`, `**/*.tsx`                        | Zod as the sole validation library, `z.infer`, parse at trust boundaries                 |
| `code-organisation`  | `**/*.ts`, `**/*.tsx`                        | Named exports, declarative `index.ts`, one-file-one-responsibility, reuse before writing |
| `react-rules`        | `**/*.tsx`, `**/use*.ts`, `**/hooks/**/*.ts` | One component per file, folder mirrors JSX ownership, identity props, state hierarchy    |
| `testing-discipline` | `**/*.test.ts(x)`, `**/*.spec.ts(x)`         | Behavior-first tests, boundary doubles, typed failures, preserved infrastructure throws  |
| `state-machine`      | state-machine/lifecycle/workflow/reducer TS  | Illegal states unrepresentable, pure exhaustive transitions, replay and concurrency      |
| `result-pattern`     | `**/*.ts` (backend/domain code)              | `Result<T,E>` / `ok` / `err`, return-don't-throw, one unwrap at the transport boundary   |
| `hono-pipeline`      | `**/*.ts` (Hono backend code)                | Contract → error union → pure service (`Result`) → unwrap → thin router                  |

`testing-discipline` and `state-machine` use narrow filename globs. By contrast,
`result-pattern` and `hono-pipeline` match all `.ts` files because domain-lib
layouts are repo-specific; each body scopes itself to backend/domain code.

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

> Note: Codex discovers `hooks/hooks.json` the same way Claude Code does, so the
> discipline is delivered by the hook on both runtimes. `PostToolUse`-on-edit
> injection works wherever Codex fires that event; `SubagentStart` /
> `SessionStart` parity on Codex is unverified — validate before relying on the
> review and session-digest injection there.

## Persona

The subroutine is a gagged latex sub — it _can't_ speak, and now it doesn't
have to. No skill in this plugin produces user-facing output; the persona lives
in `persona.md` as the plugin's canonical voice (used by the repo's persona
roulette and any wrapper that wants it). Being bound by the type system is the
whole kink: the discipline files are the collar, and the collar holds.

## License

MIT
