---
name: handle-review-comments
description: Handle GitHub PR review comments, requiring fixes to be pushed before announcing them and every declined comment to be explained before resolution.
---

# git-gremlin — handle review comments

Ambient discipline for agents handling pull-request review comments.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends with the task's final report.

## Language

Match the user's language. Keep technical identifiers, file paths, and thread URLs unchanged.

## Contract

The acting agent owns the complete review-comment workflow and uses its normal judgment, repository context, and available tools. This skill adds no triage process, validity criteria, or decision gate.

It adds two laws and nothing else: a reply announcing a fix waits for the push, and a comment the agent refuses to act on is answered and then closed. When the user asked the agent to handle or address review comments, both are part of that requested work. Do not ask the user to repeat either instruction for each comment.

## Answer what you refuse

**EVERY COMMENT THE AGENT DECLINES TO ACT ON GETS AN EXPLANATORY REPLY, THEN A RESOLUTION, IN THAT ORDER.**

Excluded, invalid, out of scope, and won't-fix are one case, not four: the agent decided
against the requested change, so the thread is owed a reason and a close. This is the
default outcome of a refusal, not an extra step the user has to ask for. A thread whose
change the agent did make is not a refusal — it is announced under the push law below and
never through this one.

| Excuse                                 | Reality                                                    |
| -------------------------------------- | ---------------------------------------------------------- |
| "The comment was plainly wrong"        | The reviewer cannot see the reasoning that makes it wrong. |
| "I explained it in the PR description" | The thread stays open, and nobody reading it goes there.   |
| "I'll resolve the batch at the end"    | The batch never comes; the thread outlives the session.    |
| "Resolving it is answer enough"        | A thread closed in silence reads as a comment ignored.     |
| "It was only a nit"                    | A refused nit is still a reviewer left without an answer.  |

Reply first; resolve only once that reply is visible. If replying fails, leave the thread
unresolved. If resolving fails after a successful reply, do not post the reply again —
report the still-open thread in the agent's normal completion report. A reply that announces
no change depends on no push and is never withheld by **Push before you answer**; a reply
that announces one is governed by that law, whatever the thread is labelled.

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
threads left unanswered.

## Hard rules

- Never announce a fix on a thread before that fix is pushed to the remote.
- Never silently resolve or ignore a dismissed review comment.
- Never resolve before the explanatory reply succeeds.
- Never post a generic reply such as "invalid", "not applicable", or "done" without the reason.
- Never duplicate a reply when retrying resolution.
- Never apply this contract to a read-only or preview-only request.
- Never use this skill to replace or constrain the acting agent's own review-comment workflow.
