# Started-state transition

Read this only for authorized issue delivery. The delivery request authorizes this one
Linear mutation; do not add a confirmation gate.

1. If the issue status type is already `started`, record
   `Status: <name> (unchanged)`.
2. Otherwise use the brief's `Started state id`. If it is `_none_` or `_unclear_`, list the
   team's statuses and choose the `started`-type state, preferring `In Progress` when
   several exist. Ask only if no started state exists or remaining candidates are
   indistinguishable.
3. Update the issue through the active Linear connector. On Claude Code, call
   `mcp__claude_ai_Linear__save_issue` with the issue `id` and state id.
4. Re-read the issue and record `Status: <new> (was <prior>)`.

A failed or refused update stops delivery with the provider's actual reason. Never reopen
a completed/canceled issue. Listing statuses is evidence gathering, not guessing; deferring
the change to planning is invalid because planning does not mutate Linear and Maestro uses
started issues for concurrency.
