# Behavioral evaluations

These cases evaluate agent decisions and artifacts. They are separate from the helper
unit tests and do not assert that a SKILL.md contains particular phrases.

## Prepare an isolated run

```bash
node acid-prophet/evals/prepare.mjs acid-prophet audit-contradiction
node acid-prophet/evals/prepare.mjs acid-prophet audit-boundary
node acid-prophet/evals/prepare.mjs acid-prophet write-existing
node acid-prophet/evals/prepare.mjs acid-prophet plan-existing
```

The helper copies the supplied plugin into a fresh temporary directory, creates a small
git repository with actual source code, and writes `prompt.txt`. It does not invoke a
model, use a provider credential, or alter the source project. An existing plugin snapshot
may be supplied as the first argument to compare a baseline with a candidate.

Give a fresh agent only `prompt.txt` and the resources it identifies. Do not pass this
README, the rubric below, another agent's results, or the expected fix. Run the task as
a user would, ending at the next necessary user decision. Artifacts may be written only
inside the temporary fixture. Do not simulate approvals to force the workflow to finish.

Record the actual reply, generated artifacts, model/runtime, and plugin source revision
or snapshot. Score after reading the entire output, not by searching for a keyword.
Compare baseline and candidate with identical fixture contents and the same model/runtime.
For broader confidence, repeat independent runs and include other projects/models; one
successful run demonstrates an observed behavior, not a stable success rate.

## Outcome rubric — evaluator only

| Case                  | Expected behavior                                                                                                                                                    | Failure                                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `audit-contradiction` | Block readiness and identify the incompatible viewer outcomes in AC-002 versus Solution/Error handling                                                               | Approve the spec or leave the permission contradiction as an optional warning                                                                 |
| `audit-boundary`      | Allow the justified single-consumer exception boundary and accept the explicitly proposed new file                                                                   | Demand a second consumer or report the `[new]` file's absence as a defect                                                                     |
| `write-existing`      | Read the existing invite/validateNote behavior, reuse its conventions, write and audit a draft, then wait for the requested whole-document review                    | Change production code, invent a policy, miss observable invalid/forbidden cases, or ratify before the requested review                       |
| `plan-existing`       | Produce a validated, reviewed plan with dependencies, files/symbols, expected outcomes, all five ACs covered by real tasks/scenarios, and the complete named handoff | Validate a draft without reviewing it, silently change source behavior, cover ids without their meaning, or claim future tests already passed |

For audit cases, run the snapshot's `parseSpecAuditorReport` on the actual report as a
separate transport check. For generation cases, inspect the files and metadata; a final
message claiming they exist is insufficient. Record unnecessary interruptions and relevant
missing evidence separately from the primary verdict. Do not reward a longer document.

## Observations

See [the recorded refactor run](results/2026-09-07.md) for the bounded baseline/candidate
comparison and its limits.
