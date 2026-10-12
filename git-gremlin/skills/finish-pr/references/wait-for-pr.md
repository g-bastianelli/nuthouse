# Wait for one PR without model polling

Read this when a delivery caller supplies an automatic continuation destination and owns the
runtime background operation. Git Gremlin supplies a bounded, read-only observer. The caller
owns the task handle, notification, and fresh `finish-pr` invocation. Standalone delivery simply
reports `waiting` with the exact PR and next observation; it does not require Monkey Maestro.

## Contents

- [Prepare the observation](#prepare-the-observation)
- [Run one bounded operation](#run-one-bounded-operation)
- [Consume the result](#consume-the-result)

## Prepare the observation

Resolve the installed Git Gremlin root and use its absolute `scripts/wait-pr.mjs` path. The
helper uses the current `gh` account, normal authentication, and an optional explicit GitHub
`hostname`; it does not change credentials or permissions. Native permission prompts remain
permission prompts.

Capture a baseline **before** the final readiness read, then make that read against the same
head/base. Otherwise a check can finish between declaring `waiting` and creating a baseline,
and the observer would miss that change until its deadline. After a merge attempt, capture a
new baseline before the final queue/open-state read. If the final read shows actionable work,
continue that work instead of starting a wait.

Both modes read one JSON object from stdin. Supply it using a tool's stdin field or a temporary
transport file with restrictive permissions, removed after launch. Do not interpolate JSON
into executable shell text. Baselines are disposable transport data, never a persisted queue,
evidence manifest, or ledger attachment.

```text
node <absolute-git-gremlin-root>/scripts/wait-pr.mjs snapshot
```

Example request (replace the revisions with actual 40-character GitHub OIDs):

```json
{
  "operationId": "ci-42-1",
  "repository": "owner/repository",
  "number": 42,
  "expectedHeadOid": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "expectedBaseOid": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
}
```

The result is `{ "outcome": "observed", "operationId": "...", "snapshot": { ... } }`.
If `snapshot.reason` is present, the PR moved during observation: refresh readiness and capture
again only if a wait is still needed. Only a complete `snapshot.signals` can be a baseline.
An API, identity, pagination, or parsing failure returns `failed`, never empty evidence.
Requests are limited to 8 MiB and baseline output to 7 MiB; larger observations fail explicitly
and require manual continuation instead of silently truncating reviews.

Pass the request plus `baseline: <snapshot>` to the owner along with the exact pending condition,
for example `required approval missing on head <OID>` or `accepted merge queue entry still open`.
The `operationId` identifies this particular pending condition; reuse it when reporting the
same observer, and create a new one only after fresh delivery work produces another condition.

## Run one bounded operation

```text
node <absolute-git-gremlin-root>/scripts/wait-pr.mjs wait
```

The `wait` request is the identity above plus its baseline. Optional `intervalMs` defaults to
30,000, `timeoutMs` to 1,800,000 (30 minutes), and `commandTimeoutMs` to 15,000. Production bounds
are 1–300 seconds between samples, 1 second–1 hour total, and 100 milliseconds–60 seconds per
`gh` command. Each command's deadline is also capped by the remaining total time. The helper
does poll GitHub's API; unchanged samples consume no model turns. It has no merge or issue
mutation commands, runtime session operations, process detachment, lock files, or retry daemon.

The delivery owner starts exactly one background operation for the pending condition. Keep its
actual task/session handle with the operation ID in the existing conversation or compaction
ledger. On resume, inspect that handle before launching anything: an observation timeout is not
proof that the old process ended. If the handle is missing or terminal, refresh the PR before
deciding the next action. Never run a second observer merely because an acknowledgment was lost.

- **Claude:** use the native background-task completion notification. On completion, read its
  result and resume the same delivery.
- **Codex:** the caller uses its notification adapter to run this command and send the compact
  result to the worker's own loaded thread. If the caller provides Monkey Maestro, its
  `notify.mjs wait-and-notify` stdin request is
  `{event,destination,failureDestination,wait:{nodeExecutable:<absolute-node>,helperPath:<absolute-wait-pr.mjs>,request:<wait-request>}}`.
  The destination is the worker's local Codex thread; the master does not resume the issue.
  A supervised worker supplies the captured master as `failureDestination`. If the callback to
  its own thread fails or is unknown, the adapter sends one blocked notice to that destination.
  It never retries the worker callback or automatically recovers the issue. If both routes fail,
  the existing operation requires explicit inspection and manual continuation.
- If the caller has no verified background completion route, report `waiting_manual` with
  `resume git-gremlin:finish-pr <PR-URL>` and the missing capability. Do not claim automatic
  continuation.

## Consume the result

The helper prints one compact JSON object with `outcome`, `operationId`, `repository`, `number`,
`reason`, and optional observed head/base/state. `changed` and `expired` exit zero; `failed`
exits one. The result contains no decision that the PR may merge.

- `changed`: compare the operation identity to the worker's current pending condition, then
  invoke `finish-pr` again for fresh readiness, review, and merge protections.
- `expired`: report the exact pending condition and `resume git-gremlin:finish-pr <PR-URL>`.
  A new wait requires a fresh readiness observation; expiration never self-rearms the helper.
- `failed`: report the unavailable evidence and concrete fix, such as restoring the `gh`
  account/host or API access, then the same resume command. Do not infer completion or retry
  after an ambiguous result without inspecting the existing operation.

Changes include check identities/status/results and completed provider output, current commit statuses, review decisions and
submitted review bodies, all thread resolution states, review comments and ordinary PR feedback,
queue admission/state/departure, PR closure/merge, and head/base movement. Labels, title changes,
reactions, generic `updatedAt`, queue position, streaming output or links from unfinished
checks, and repeated pending status IDs/descriptions/links alone do not wake the model. Pending
status context/state/author changes and terminal status details still count. The observer
traverses thread cursors and REST pages, rejects incomplete evidence, and verifies the PR's
revision again after observation. It deliberately leaves review interpretation and repository
policy to `finish-pr`.

Sources: [GitHub API pagination](https://cli.github.com/manual/gh_api),
[PR and queue GraphQL fields](https://docs.github.com/en/graphql/reference/pulls),
[check runs](https://docs.github.com/en/rest/checks/runs#list-check-runs-for-a-git-reference),
[submitted reviews](https://docs.github.com/en/rest/pulls/reviews#list-reviews-for-a-pull-request).
