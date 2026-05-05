# linear-devotee

![linear-devotee](./assets/banner.png)

Linear workflow plugin for Claude Code and Codex. It detects Linear issues, prepares SDD-formatted context, separates intake from planning, tracks spec drift, and creates Linear projects, milestones, and issues behind explicit mutation gates.

Voice = decorative feral devotee. Normal workflow feedback stays factual; the persona appears only as an optional one-line ornament around visible transitions.

## Skills

| Skill | What |
|---|---|
| `linear-devotee:greet` | Detects issue from branch or first prompt, delegates issue context to a cheap read-only scout, sets In Progress when allowed, resolves the Acid Prophet source spec when present, writes greet context, then hands off to `plan`. It never writes implementation code |
| `linear-devotee:plan` | Builds and iterates an implementation plan from greet context or an issue id, delegates plan review, flags spec drift, writes a validated plan artifact, and syncs accepted spec drift only after validation |
| `linear-devotee:create-project` | Creates a Linear Project from a spec file or vibe-mode Q&A. Drafts a Project-SDD via the `project-drafter` subagent, previews, mutates Linear on approval, writes a chain-state file, can hand off to `create-milestone` |
| `linear-devotee:create-milestone` | Creates a Linear Milestone — chained from `create-project` (auto-loads project + drafted phases) or standalone (project picker + freeform hint). Drafts via the `milestone-drafter`, previews, mutates, can hand off to `create-issue` |
| `linear-devotee:create-issue` | Creates a Linear Issue with a strict SDD-formatted description — chained from `create-milestone` (cascades through suggested issues) or standalone (project + optional milestone + hint). Drafts via the `issue-drafter`, previews, mutates |

## Agents (read-only Linear scouts)

| Agent | Used by | Drafts |
|---|---|---|
| `issue-context` | `greet`, `plan` | SDD brief on an existing issue |
| `plan-auditor` | `plan` | Plan-vs-issue-vs-spec review with drift items and blockers |
| `project-drafter` | `create-project` | Project-SDD + decomposition proposal + suggested issues |
| `milestone-drafter` | `create-milestone` | Milestone draft (name, scope, target date, suggested issues) |
| `issue-drafter` | `create-issue` | SDD-formatted issue draft (Goal/Context/Files/Constraints/Acceptance/Non-goals/Edges) |
| `devotee` | visible skill transitions | One decorative persona line, never task facts |

All Linear scout agents are read-only on Linear (no `save_*` tools). `devotee` can only read the shared persona-line contract. Skills do all writes, always behind explicit `(y)` confirmation.

## Persona lines

`devotee` reads `shared/persona-line-contract.md` and returns strict JSON:

```json
{ "line": "<decorative line>" }
```

The line is display-only. It never goes into specs, plans, SDD drafts, Linear descriptions, reports, or state files. If persona generation is unavailable, skills skip it silently.

## Greet and source specs

`greet` is a context gate only. It never offers "code now", never drafts an implementation plan, and never edits implementation files. Linear issue/context loading is delegated to the `issue-context` scout so the main model only orchestrates, performs approved workflow mutations, resolves the source spec, and writes a small greet context artifact.

`plan` owns planning. It loads greet context, resolves or verifies the Acid Prophet source spec, writes `docs/linear-devotee/plan/<issue>.md` at the project root, dispatches `plan-auditor`, and iterates until the plan is validated. Planning iterations only flag `SPEC_DRIFT_DETECTED`; they do not patch the spec. Once the user validates the plan, `plan` reviews the final plan against the issue and spec, patches accepted drift in one pass, updates `last-reviewed`, and runs the Acid Prophet audit when available.

## Detection (`greet` only)

Claude Code has two hook-driven stages, **start of session only**:

1. **SessionStart hook** — reads `git branch --show-current`, regex `[A-Z]+-[0-9]+`. Match → invokes `linear-devotee:greet`.
2. **UserPromptSubmit hook** — if the branch didn't yield an ID, scans the first user prompt. Match → invokes `linear-devotee:greet`.

After the first prompt: total silence. The greet window closes.

Codex does not expose the same hook model, so `linear-devotee:greet` is invoked explicitly and detects the Linear identifier from the invocation argument or current branch.

## Cascade chain

`create-project` → `create-milestone` → `create-issue` form a hand-off chain. Each skill is also invocable standalone. Chain state lives at `${CLAUDE_PLUGIN_ROOT}/data/chain-${CLAUDE_SESSION_ID}.json` and carries the project_id, drafted milestones, drafted issues, and created-vs-pending counters.

The `milestone-drafter` can annotate suggested issues with `[blocked-by: <idx>, <idx>]` to encode hard ordering inside a milestone. `create-issue` then picks issues whose dependencies are already created first (topological cascade) and forwards the resolved Linear identifiers to `save_issue` as `blockedBy`, so the Linear UI shows the dependency chain natively — and an empty `blocked_by` list means the issue is a safe entry point.

## Requirements

- Linear MCP/app tools loaded in the session
- A git repository
- For `greet`: a detectable Linear identifier (regex `[A-Z]+-[0-9]+`)

## Install

### Claude Code

```
/plugin marketplace add g-bastianelli/nuthouse
/plugin install linear-devotee@nuthouse
```

Restart Claude Code after install.

### Codex CLI

```
codex plugin marketplace add g-bastianelli/nuthouse
```

Then open the plugin browser (`/plugins`) and install `linear-devotee`.

## Runtime layout

```text
linear-devotee/
|-- .codex-plugin/
|-- assets/
|-- claudecode/
|   |-- agents/
|   |-- hooks/
|   |-- skills/
|   `-- tests/
|-- codex/
|   `-- skills/
`-- shared/
```

## License

MIT
