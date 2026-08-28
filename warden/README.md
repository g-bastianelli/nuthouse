# warden

![warden](./assets/banner.png)

Workflow-mode and voice controls for nuthouse plugins.

It manages a temporary rigor preference for the current Git worktree, centralizes decorative persona lines, and gives the user one global voice switch. Domain plugins keep their own workflow kernel and remain operational when Warden is absent.

## Skill

| Skill          | Purpose                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------- |
| `warden:mode`  | Set, inspect, or reset the current worktree's `quick`, `standard`, or `strict` profile        |
| `warden:voice` | Toggle fun messages on/off/status, or dispatch one strict JSON persona line for Codex callers |

## Agent

| Agent   | Purpose                                                                                     |
| ------- | ------------------------------------------------------------------------------------------- |
| `voice` | Claude Code dispatcher that reads a caller persona contract and returns one decorative line |

## Contract

`warden:mode` is a thin client over Warden's install-local workflow bundle. Its temporary override is isolated by Git worktree, expires within 24 hours, and never edits personal or repository configuration.

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
/warden:voice on
/warden:voice off
/warden:voice status
```

Codex uses the same actions through `$warden:mode` and `$warden:voice`.
