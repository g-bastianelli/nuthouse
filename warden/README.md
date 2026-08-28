# warden

![warden](./assets/banner.png)

Workflow routing, mode, and voice controls for nuthouse plugins.

It classifies normalized task signals, manages a temporary rigor preference for the current Git worktree, centralizes decorative persona lines, and gives the user one global voice switch. Domain plugins keep their own workflow kernel and remain operational when Warden is absent.

## Skill

| Skill          | Purpose                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------- |
| `warden:mode`  | Set, inspect, or reset the current worktree's `quick`, `standard`, or `strict` profile        |
| `warden:route` | Classify a task and return its declarative workflow target without executing it               |
| `warden:voice` | Toggle fun messages on/off/status, or dispatch one strict JSON persona line for Codex callers |

## Agent

| Agent   | Purpose                                                                                     |
| ------- | ------------------------------------------------------------------------------------------- |
| `voice` | Claude Code dispatcher that reads a caller persona contract and returns one decorative line |

## Contract

`warden:mode` is a thin client over Warden's install-local workflow bundle. Its temporary override is isolated by Git worktree, expires within 24 hours, and never edits personal or repository configuration.

`warden:route` is a thin, read-only client over the same local bundle. The skill normalizes explicit Linear-project intent in the user's language; the kernel combines that signal with syntactic Linear issue identifiers and returns `project-creation`, `issue-delivery`, `direct-task`, or `ambiguous`. Targets are descriptors only: Warden never invokes them or mutates domain artifacts.

Callers may try `warden:voice` at user-visible workflow transitions only: skill start, context resolved, user decision point, external mutation gate, handoff, recoverable failure, final report, and clean exit.

Never put persona lines into specs, plans, Linear descriptions, commit messages, PR bodies, or state files.

## Install

Claude Code:

```text
/plugin marketplace add g-bastianelli/nuthouse
/plugin install warden@nuthouse
```

Codex CLI:

```text
codex plugin marketplace add g-bastianelli/nuthouse
```

Then open `/plugins` and install `warden`.

## Usage

```text
/warden:mode quick
/warden:mode standard
/warden:mode strict
/warden:mode status
/warden:mode reset
/warden:route <task description>
/warden:voice on
/warden:voice off
/warden:voice status
```

Codex uses the same actions through `$warden:mode`, `$warden:route`, and `$warden:voice`.
