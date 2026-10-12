# Notification implementation verification — 2026-10-12

## Scope

Transport and worker-continuation tests used dedicated Superset terminals in the existing
development workspace. No Linear project was activated, issue dispatched, PR modified, or
merge requested. The real GitHub observation targeted the already merged
[nuthouse PR #95](https://github.com/g-bastianelli/nuthouse/pull/95).

Installed versions: Superset 1.37.0, Codex 0.162.1, Claude Code 2.1.296, Node 26.1.0,
Bun 1.3.13. Results describe these builds, not a minimum-version guarantee.

## Repository checks

| Check                                                        | Result                            |
| ------------------------------------------------------------ | --------------------------------- |
| `bunx bun test monkey-maestro/ linear-devotee/ git-gremlin/` | 172 passed, 0 failed              |
| `bunx bun test` in `.claude/hooks/tests`                     | 24 passed, 0 failed               |
| `bun run test:meta`                                          | 111 passed, 0 failed              |
| `bun run check:skills`                                       | Passed                            |
| `bun run check:workflow`                                     | Passed                            |
| `bun run check:codex-agents`                                 | Passed; sync generated no changes |
| `bun run check:duplication`                                  | Passed                            |
| `bun run lint`                                               | Passed, no warnings               |
| `bun run fmt:check`                                          | Passed                            |

The existing declared development dependencies were installed with
`bun install --frozen-lockfile --ignore-scripts`; no dependency or lockfile change was needed.
Of the plugin tests, 35 exercise notification transport/continuation and 27 exercise PR
observation. These cover literal shell arguments, exact receipt/terminal identity, bounded
timeouts, ambiguous results, cleanup, callback failure, pagination, revision movement,
malformed evidence, and suppression of progress-only CI changes.

## Review regression checks

The Codex enqueue subprocess now removes inherited Superset context and sender TUI logging
variables from its own environment while retaining the destination's explicit `CODEX_HOME`.
Four subprocess cases cover terminal, tab, and pane identifiers, including a sender without
an agent ID. They verify that enqueue emits no lifecycle event, preserves ordinary provider
environment, and leaves the sender's environment unchanged.

An additional isolated check used a copy of the installed Superset Codex wrapper with an
inert capture hook and a substitute Codex executable. Inherited sender context reproduced
the false `SessionEnd`; the corrected helper returned `queued` with zero lifecycle events
and the requested destination home. No real Superset lifecycle hook was invoked.

The PR observer now counts stdin bytes before buffering and decodes UTF-8 once. Its actual
CLI regression splits an emoji across two stdin writes while the substitute GitHub CLI
returns unchanged review evidence. Before the fix it returned `changed` with
`pr-evidence-changed`; after the fix it returns `expired` with `deadline-reached`. The 8 MiB
input bound is retained. The affected-plugin suite, lint, and formatting were rerun after
these fixes.

## Native runtime evidence

Every received probe below was confirmed in the destination's assistant transcript, beyond
the helper's `queued` or `written` result. Both actual sender runtimes executed the new
notification helper. Sender sessions used the user's existing Superset agent presets.

| Sender → receiver | Event ID                               | Observed response                    |
| ----------------- | -------------------------------------- | ------------------------------------ |
| Claude → Claude   | `5cb1969d-e884-4c86-acaf-f9c0118404e5` | `RECEIVED … NATIVE_CLAUDE_TO_CLAUDE` |
| Claude → Codex    | `4ff6f54b-0394-42e0-8244-3f8ec64fd034` | `RECEIVED … NATIVE_CLAUDE_TO_CODEX`  |
| Codex → Claude    | `ecb05997-9241-4131-9def-c7d09aef1287` | `RECEIVED … NATIVE_CODEX_TO_CLAUDE`  |
| Codex → Codex     | `d13c98e1-2aef-4b1f-bd1c-19c5f809ca00` | `RECEIVED … NATIVE_CODEX_TO_CODEX`   |

Claude receivers were launched with session-only `crossSessionInbound: accept` and manual
command permissions. The initial Claude receiver subsequently displayed a native Bash
permission prompt. Another notification was written while that prompt was open; the prompt
remained unanswered and the command was not executed. The test terminal was then disposed
without answering it. No global/project settings or sender permission-class claims changed.

Codex's busy test executed a 20-second command from `09:59:30.662Z` to `09:59:50.842Z`.
Two concurrent events were enqueued at `09:59:37.505Z`, while the command was running. Both
were answered after `BUSY_TEST_DONE`, with their distinct event IDs intact.

The Codex sender started a real subprocess with a one-second tool yield, ended its turn with
`SELF_WAIT_ARMED`, and did not poll the process. After a 15-second test delay, the subprocess
ran the new PR observer against GitHub and queued the same thread. The next native event
produced `SELF_WAIT_RESUMED native-codex-worker-self-wait`. This verifies process survival and
the explicit callback after the worker ends its turn.

The Claude sender ran `sleep 3` as a native background Bash task. After `BACKGROUND_ARMED`,
Claude received the runtime's `task-notification` and emitted `BACKGROUND_COMPLETED` without
polling. The real PR observer was separately exercised against GitHub; this background test
checks the Claude continuation mechanism rather than a live CI transition.

An intentionally missing self-notification executable produced `failed`; the wrapper sent
one distinct `blocked` event to the captured fallback destination. That destination received
the event and took no recovery action for the unrelated operation.

## Superset relay and lifecycle

The host-targeted create → native helper → receipt → exact-terminal close path passed for
both receiver providers on the available host. A final relay test also passed after the
30-second receipt-deadline fix. The tests verified receipts and assistant responses separately.
Unit regressions cover a valid receipt delayed six seconds and the full deadline without a
receipt; fast empty reads no longer close the sender prematurely.

An idle observation started at `10:00:53.506Z`; final inspection at `11:20:05.403Z` found
both native receiver prompts still loaded and no new conversation/tool records. Codex's
transcript was unchanged. Claude's file modification time changed, but its conversation was
identical and no record timestamp followed the start of the observation. The initial
mtime-only test therefore produced a false failure, resolved by inspecting semantic records.
This is an idle-runtime smoke test, not a measurement of provider billing or a live project
supervision run.

After the Codex sender terminal was disposed, a test enqueue still returned `queued`, but
the event never entered that thread's transcript during the subsequent observation. No
replacement terminal appeared. This demonstrates why acceptance is not processing evidence.

All dedicated agent terminals and returned relay terminals were disposed by exact ID.
The final workspace terminal listing contained only the original development terminal.

## Behavioral audit and limits

An independent source-based audit found and rechecked five corrected issues: premature relay
cleanup, unnoticed self-callback failure, wakes on running CI progress, premature event
deduplication, and a worker self-route requested before its thread existed. It found no
remaining blocking issue in the inspected implementation and skills.

Deduplication after partial handling, stop races, single-supervisor ownership, and fresh
Linear/merge gates were reviewed as skill behavior. They were not exercised by scheduling a
real project. This report does not turn the transport tests into full project-delivery proof.

Only one Superset host was online. The user confirmed that no second host was available.
Actual cross-machine authentication, installation paths, and relay delivery therefore remain
unverified; same-host relay tests do not establish two-host compatibility. Native Windows
messaging is also outside this Unix-socket adapter's verified scope. Closed or unavailable
runtimes, silent process failure, and external Linear edits require explicit inspection;
there is no periodic master fallback or guaranteed delivery claim.

Raw test inputs, sender receipts, and transcript captures were kept as disposable local
evidence under `/tmp/maestro-notifications-ff47wy`. Their paths are not runtime dependencies.
