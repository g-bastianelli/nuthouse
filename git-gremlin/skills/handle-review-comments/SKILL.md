---
name: handle-review-comments
description: Handle received GitHub PR review comments end to end — verify each one against the code, fix and push the valid ones, and answer then resolve every comment left unfixed. Asks the user only about sensitive, overengineered, large-refactor, out-of-scope, or priority-call comments. Not for writing or posting a review.
---

# git-gremlin — handle review comments

Clear a PR's review feedback: every thread ends fixed and announced, or answered, and then resolved.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends with the task's final report.

## Language

Match the user's language. Keep technical identifiers, file paths, and thread URLs unchanged.

## Authority

A request to handle, address, or process a PR's review comments authorizes the whole loop for
that PR: read the feedback, fix the valid comments, verify, commit the fixed paths, push them
to the PR's head branch, reply, and resolve. Ask nothing before the commit or the push — the
request was the approval. Stop only on a real blocker: a rejected push, divergent history, or
a check the fix cannot make pass.

The user decides only these comments, and the agent judges which ones qualify:

- **Sensitive** — the change touches security, auth or permissions, data integrity or
  migrations, a public API, an intended change of user-visible behavior, or cost. A bug fix
  that restores intended behavior is not sensitive.
- **Overengineering** — the comment asks for an abstraction, option, layer, or generality
  this PR does not need.
- **Large refactor** — the fix reaches well beyond the lines under review: many files, moved
  or renamed modules, a changed structure.
- **Out of scope** — the point may be right, but it belongs to another PR or issue. A small
  fix outside the diff (a typo, a doc line) is not out of scope.
- **Priority call** — any other comment whose right answer depends on the user's priorities
  rather than on what the code shows.

Settle every other comment alone. Ask the qualifying ones together, once, after the clear
ones are handled: each with the thread URL, the one-line request, and the agent's
recommendation. Their threads stay untouched until the answer, which then routes each one to
a fix or a refusal below.

A read-only or preview request (list, summarize, draft replies) mutates nothing. This authority
never covers a force-push, a merge, marking the draft ready, or dismissing a review;
`git-gremlin:finish-pr` owns that path. When `finish-pr` invokes this skill, its PR
reconciliation replaces step 1 and its commit and push replace those of step 3; replies and
resolutions still follow here. A thread awaiting the user's decision stays open: the grouped
question becomes that caller's `blocked` decision.

## Workflow

1. Resolve the PR — the one named, or the current branch's — with
   `gh pr view <pr> --json number,url,headRepository,headRepositoryOwner,headRefName,headRefOid`.
   Find the local remote whose URL is that head repository; a branch-name match alone is
   wrong for a fork. No such remote, no push access, or local history diverging from
   `headRefOid` is a blocker to report before editing; a clean branch that is only behind
   fast-forwards with `git merge --ff-only` — on a mutating request, and only once the
   checked-out branch is the PR branch. Then load every unresolved review thread,
   outdated ones included, with the commands below, and read review bodies and ordinary PR
   comments too.
2. **Verify each comment before acting.** Read the code it targets at the current head. A
   comment is valid when its claim holds on that code. A
   reviewer's confidence, human or bot, is not evidence: a suggestion is applied because the
   code proves it right, not because someone wrote it. Set the comments the user decides
   (see **Authority**) aside for a single question.
3. Fix the valid comments and run the checks that demonstrate the fixes.

   **REQUIRED SUB-SKILL:** Use `git-gremlin:commit` with the fixed paths as explicit scope.

   Push with `git push "$HEAD_REMOTE" "HEAD:$HEAD_REF"`, then re-read `headRefOid` and confirm
   it equals `git rev-parse HEAD`. Only then reply on each fixed thread with what changed and
   the commit hash, and resolve it — under **Push before you answer**.

4. Every other comment — wrong, or no longer applicable on the current head — goes through
   **Answer what you refuse**. Feedback in a review body or ordinary PR comment has no thread:
   after the push, answer all of it in one PR comment (`gh pr comment`) — fixed items with
   their commit hash, declined items with their reason.
5. Ask the set-aside comments, apply the answers through steps 3–4, then report.

```sh
# Unresolved threads with their comments; keep each thread id.
gh api graphql --paginate -f owner="$OWNER" -f name="$REPO" -F number="$NUMBER" -f query='
query($owner: String!, $name: String!, $number: Int!, $endCursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviewThreads(first: 100, after: $endCursor) {
        pageInfo { hasNextPage endCursor }
        nodes { id isResolved isOutdated path line comments(first: 50) { nodes { author { login } body url } } }
      }
    }
  }
}'

# Reply on a thread, then resolve it.
gh api graphql -f id="$THREAD_ID" -f body="$REPLY" -f query='
mutation($id: ID!, $body: String!) {
  addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $id, body: $body }) { comment { url } }
}'
gh api graphql -f id="$THREAD_ID" -f query='
mutation($id: ID!) { resolveReviewThread(input: { threadId: $id }) { thread { isResolved } } }'
```

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
report the still-open thread. A reply that announces no change depends on no push and is
never withheld by **Push before you answer**; a reply that announces one is governed by that
law, whatever the thread is labelled.

## Push before you answer

**A REPLY THAT ANNOUNCES A FIX MUST NOT PRECEDE THE PUSH OF THAT FIX.**

| Excuse                            | Reality                                                |
| --------------------------------- | ------------------------------------------------------ |
| "The commit is right there"       | A local commit does not exist for the thread's reader. |
| "I'll push in a second"           | The thread is already claiming something untrue.       |
| "The reviewer will re-read later" | The next agent reading the thread will not.            |

Until the fix is on the remote, the announcing reply waits. If the push fails, no announcing
reply goes out — report the failure and name the threads left unanswered.

## Report

```text
git-gremlin:handle-review-comments report
  PR:         <url>
  Fixed:      <n> — <thread or PR comment url → commit hash>, one per line
  Declined:   <n> — <thread url → one-line reason>, one per line
  Still open: <thread url → failure that kept it open>, or none
```

## Hard rules

- Never ask the user about a comment outside the **Authority** list, nor about the commit or the push.
- Never apply a comment without first checking its claim against the current code.
- Never announce a fix on a thread before that fix is pushed to the remote.
- Never silently resolve or ignore a declined review comment.
- Never resolve before the explanatory reply succeeds.
- Never post a generic reply such as "invalid", "not applicable", or "done" without the reason.
- Never duplicate a reply when retrying resolution.
- Never force-push, merge, mark the PR ready, or dismiss a review under this skill.
