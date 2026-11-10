# Workflow regression cases

Use only the rows matching the changed behavior. Adapt project names, paths, and available
tools to the repository. These are task cases for an evaluator, not prose assertions.

| Area               | Cases                                                                                                                                                       | Required outcome                                                                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Skill creation     | Create a both-runtime plugin with a SessionStart hook; create a repository-only workflow; create a repository workflow with artifacts or delegated reading. | Shared hook discovery works; internal source and symlink agree; internal artifacts and agent resolution do not assume a parent plugin.                     |
| Review scope       | Review one named skill; review internal skills only; review all with edits already authorized.                                                              | Exact requested scope, no symlink duplicates, and no repeated scope or approval question.                                                                  |
| Research           | Look up one clear fact; investigate a disputed comparison with one free agent slot; check a claim with no supporting or contradicting source.               | Proportionate dispatch, bounded waves without lost evidence, and uncertainty distinguished from refutation. Newly found decisive sources reach the answer. |
| Project delivery   | Completed blocker in another project; active or inaccessible external blocker; stop or dependency change during reservation.                                | Only the first case starts; external rows never consume project capacity; fresh control and blocker evidence precede launch.                               |
| Consistency        | Direct and orchestrated delivery with two started states; explicit state already selected; workspace tag display `design, review`.                          | Same status policy on both paths; prior choice retained; ambiguous tags never split by guesswork.                                                          |
| Context injection  | Edit a frontend utility; edit a React hook; edit a standalone backend router through Claude Edit and Codex apply_patch payloads.                            | Shared type rules remain; backend rules stay off frontend examples; transport Result rules remain on routers.                                              |
| Release recovery   | Fresh changes; checks fail after a version bump; published manifest cannot be read.                                                                         | Bump once, resume verification for the complete release set, and report unreadable evidence instead of declaring completion.                               |
| Agent installation | Fresh personal registry; stale managed agent plus unrelated personal agent; explicit CODEX_HOME.                                                            | Preview exact targets, preserve unrelated files, apply to the active home, and verify synchronization.                                                     |

For a runtime comparison, use the same starting files and supplied evidence on Claude and
Codex. Keep mutations in disposable fixtures or mocked services. Record success, questions
asked, tool and agent calls, loaded characters or measured tokens, and elapsed time when
the runtime exposes them. Report fixture latency separately from live-service latency.

For a source-based review, walk the same cases through the actual entrypoint, routed references,
and callers. Record missing evidence and predicted outcomes; do not label that a runtime pass.
After editing, repeat the same cases and relevant existing tests. Preserve independent review
and mutation boundaries when comparing a faster path.
