# subroutine

![subroutine](./assets/banner.png)

> Gagged latex sub that begs to be bound tighter by your type rules — ships immaculate code

Ambient implementation discipline for TypeScript monorepos. The subroutine
binds each edit to the rules and checks the resulting folder before you finish.
Install it and a hook binds the discipline to your work: type-safety, the
Result/unwrap pattern, Zod validation, named-export code organisation, React
component structure, form codecs and submit discipline, behavioral testing, explicit state machines, and the
layered Hono pipeline. The agent does the work; the collar holds it to the rules. After structural
changes, `check-folder-shape` reviews the settled tree before verification. The stricter your rules, the happier
it is. The repo's own `AGENTS.md` always wins over the plugin's discipline.

## How it binds

The nine ambient disciplines are **delivered by a hook**,
not by hoping the model invokes a skill. Model-driven skill invocation is
unreliable for passive knowledge — so a hook is the only mechanism that loads
the rules deterministically while you implement:

| Hook event     | Matcher                  | What it does                                                                                                                        |
| -------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `PostToolUse`  | `Edit\|Write\|MultiEdit` | Reads the edited file path, matches it against each skill's `paths`, injects the matching discipline bodies as `additionalContext`. |
| `SessionStart` | `startup\|resume`        | In a TypeScript repo, injects a one-line-per-discipline digest so the spine is present before the first edit.                       |

Bodies use focused, reusable examples and are packed under the runtime's 10 000-
char `additionalContext` budget. A normal backend `.ts` or component `.tsx`
receives every relevant discipline in full. When a cross-stack hook matches too
many, the lowest-priority overflow degrades to a one-line summary.
The `SKILL.md` files remain the single source of truth — edit them, and the hook
delivers the change.

## Discipline (the nine rule sets)

Each discipline matches files by its `paths` globs:

| Skill                | Paths                                               | Discipline                                                                                                  |
| -------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `type-safety`        | `**/*.ts`, `**/*.tsx`                               | No `any`/`as`/`!`, string-literal unions over `enum`, `ts-pattern` `.exhaustive()`                          |
| `validation`         | `**/*.ts`, `**/*.tsx`                               | Zod as the sole validation library, `z.infer`, parse at trust boundaries                                    |
| `code-organisation`  | `**/*.ts`, `**/*.tsx`                               | Named exports, declarative `index.ts`, one-file-one-responsibility, reuse before writing, why-only comments |
| `form-rules`         | `**/*Form*.ts(x)`, `**/*Form*/**`, `**/*Fields.tsx` | Schema-owned codecs, distinct input/output types, blank-seeded required fields, ungated submit              |
| `react-rules`        | `**/*.tsx`, `**/use*.ts`, `**/hooks/**/*.ts`        | One component per file, folder mirrors JSX ownership, no nested `.map`, identity props, state hierarchy     |
| `testing-discipline` | `**/*.test.ts(x)`, `**/*.spec.ts(x)`                | Behavior-first tests, boundary doubles, typed failures, preserved infrastructure throws                     |
| `state-machine`      | state-machine/lifecycle/workflow/reducer TS         | Illegal states unrepresentable, pure exhaustive transitions, replay and concurrency                         |
| `result-pattern`     | `**/*.ts` (backend/domain code)                     | `Result<T,E>` / `ok` / `err`, return-don't-throw, one unwrap at the transport boundary                      |
| `hono-pipeline`      | `**/*.ts` (Hono backend code)                       | Contract → error union → pure service (`Result`) → unwrap → thin router                                     |

`form-rules`, `testing-discipline` and `state-machine` use narrow filename globs
— `form-rules` also matches inside a `*Form*/` folder, because the react-rules
layout puts the `useForm` call in its `index.tsx`. By contrast, `result-pattern`
and `hono-pipeline` match all `.ts` files because domain-lib layouts are
repo-specific; each body scopes itself to backend/domain code.

## Settled-folder checkpoint

`subroutine:check-folder-shape [base]` runs after the last create/move/delete or
ownership change, before verification, task completion, or PR preparation.
`code-organisation` requires it; `react-rules` points to that same checkpoint.
Its description also appears in the session digest. No new hook event is added:
the agent must execute this named handoff; runtime enforcement is not claimed.

The skill uses a small read-only Git inventory, then reads the source to judge
cohesion. It reports direct file counts, removed entry points with surviving
files and Git rename endpoints. It covers changes from a task-start commit or
known PR merge-base through the working tree, including non-ignored untracked
files. Resolve its bundled `scripts/inventory.mjs` from the installed skill path.
No dependency installation or custom import graph is needed.

The agent checks private workflow clusters, sibling imports after moves, and
shared code at the lowest common ancestor against local `AGENTS.md` conventions.
Counts and missing indexes are signals, never architecture failures on their own.
Unrecognized moves, aliases, re-exports and semantic ownership need source review.
After fixes, repeat the checkpoint and run repository-native verification.

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
> injection works wherever Codex fires that event; `SessionStart` parity on
> Codex is unverified — validate before relying on the session-digest injection
> there.

## Persona

The subroutine is a gagged latex sub — it _can't_ speak, and now it doesn't
have to narrate every edit. Ambient contracts stay silent; the folder checkpoint
reads `persona.md` for its concise final report. That file is also used by the
repo's persona roulette. Being bound by the type system is the
whole kink: the discipline files are the collar, and the collar holds.

## License

MIT
