---
name: handle-review-comments
description: Use whenever an agent is handling GitHub pull-request review comments, whether it fixes them or dismisses them. Let the agent assess and address them autonomously; this skill adds only two invariants—a reply announcing a fix must not precede the push of that fix, and any comment the agent dismisses must receive an explanatory reply and then be resolved.
---

# git-gremlin — handle review comments

Ambient discipline for agents handling pull-request review comments.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends with the task's final report.

## Language

Match the user's language. Keep technical identifiers, file paths, and thread URLs unchanged.

## Contract

The acting agent owns the complete review-comment workflow and uses its normal judgment, repository context, and available tools. This skill adds no triage process, validity criteria, or decision gate.

When the agent independently decides not to make the change requested by a review comment, that dismissal is not complete until both actions succeed, in this order:

1. Reply on the GitHub review thread with the concrete reason no change will be made.
2. Resolve that same thread only after the reply is visible.

When the user asked the agent to handle or address review comments, this reply-and-resolve pair is part of that requested work. Do not ask the user to repeat the instruction for each dismissed comment.

If replying fails, leave the thread unresolved. If resolving fails after a successful reply, do not post the reply again; report the still-open thread through the agent's normal completion report.

## Push before you answer

**A REPLY THAT ANNOUNCES A FIX MUST NOT PRECEDE THE PUSH OF THAT FIX.**

| Excuse                            | Reality                                                |
| --------------------------------- | ------------------------------------------------------ |
| "The commit is right there"       | A local commit does not exist for the thread's reader. |
| "I'll push in a second"           | The thread is already claiming something untrue.       |
| "The reviewer will re-read later" | The next agent reading the thread will not.            |

This orders the reply, not the work: the acting agent keeps its own workflow and its own
gates for `git commit` and `git push`. Until the fix is on the remote, the announcing reply
waits. If the push fails, no announcing reply goes out — report the failure and name the
threads left unanswered. A reply that dismisses a comment depends on no push and is never
withheld by this law.

## Hard rules

- Never announce a fix on a thread before that fix is pushed to the remote.
- Never silently resolve or ignore a dismissed review comment.
- Never resolve before the explanatory reply succeeds.
- Never post a generic reply such as "invalid", "not applicable", or "done" without the reason.
- Never duplicate a reply when retrying resolution.
- Never apply this contract to a read-only or preview-only request.
- Never use this skill to replace or constrain the acting agent's own review-comment workflow.
