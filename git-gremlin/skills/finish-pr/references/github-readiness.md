# Observe GitHub before merge

Use direct `gh` commands. These are observations; the acting agent owns finding dispositions and
the entrypoint's merge boundary. Substitute verified values as separate arguments, without `eval`.

Set `OWNER`, `REPO`, and `NUMBER` to the verified base repository and PR number, and `PR_HEAD`
to its current head OID. For a GitHub Enterprise host, pass the matching `--hostname` to each
`gh api` call.

## Contents

- [PR and CI](#pr-and-ci)
- [Expected external reviews](#expected-external-reviews)
- [All threads and outstanding reviews](#all-threads-and-outstanding-reviews)

## PR and CI

```text
gh pr view <PR-URL> --json url,state,isDraft,headRefOid,baseRefOid,headRefName,baseRefName,headRepository,headRepositoryOwner,mergeable,mergeStateStatus,reviewDecision,mergedAt,mergeCommit
gh pr checks <PR-URL> --json name,state,bucket,link
```

`gh pr checks` fetches all status-check pages. Read the JSON buckets and actual states; a
successful JSON command may contain failing checks. `pass` is successful, `pending` waits,
`fail`/`cancel` need a repair, and `skipping` must be a completed conditional skip.
All-skipped or missing CI does not establish successful verification. Unknown states or an
API/parse/authentication failure leave evidence unavailable.

The observed checks alone cannot prove that an expected required check exists. Require GitHub's
current `MERGEABLE` plus `CLEAN` (or `HAS_HOOKS`, where server hooks still decide) and a satisfied
review decision. `BLOCKED`, `BEHIND`, `DIRTY`, `DRAFT`, `UNKNOWN`, and `UNSTABLE` are not permission
to merge. Use `gh pr checks <PR-URL> --required --json name,state,bucket,link` to inspect required
checks when diagnosing a restriction. An empty required-check report never overrides GitHub's
blocking decision. Approval requirements, permitted actors, queue rules, and other restrictions
remain enforced by the normal server-side merge path.

Check `isDraft` independently: a draft can still report `CLEAN`. Only the authorized owner marks
it ready after completing native review and local verification.

## Expected external reviews

Determine which external reviews this PR expects from the caller, repository instructions and
configuration, and its review integrations. Require their completion even when GitHub does not
make them required checks or approvals; do not require CodeRabbit in repositories that do not
use it. Missing provider output does not remove an established expectation.

After marking ready and after every push, fetch the provider's current evidence. These native
endpoints expose review bodies, commit bindings, and provider details hidden by check buckets:

```sh
gh api --paginate --slurp "repos/$OWNER/$REPO/pulls/$NUMBER/reviews?per_page=100"
gh api --paginate --slurp "repos/$OWNER/$REPO/commits/$PR_HEAD/statuses?per_page=100"
gh api --paginate --slurp "repos/$OWNER/$REPO/commits/$PR_HEAD/check-runs?filter=latest&per_page=100"
```

For each expected provider, verify the author/app identity and require positive evidence that
its review of `PR_HEAD` finished. Read submitted review bodies with `commit_id == PR_HEAD`,
`submitted_at`, and their state, or the provider's explicit completion result from the status/check
for that SHA. A submitted `COMMENTED` review can establish completion without approval;
`latestOpinionatedReviews` alone omits that case. A pending review or a body that only announces
startup, a summary, or a skip does not establish completed review. A PR-wide comment without a
verified commit binding is insufficient.

Inspect the newest status per provider/context, and the latest matching check's `head_sha`,
app, timestamps, and output. A status description or check output must establish actual review
completion, not merely `success`, `completed`, `pass`, or a provider name. For CodeRabbit,
`Review skipped` because the PR was a draft leaves this gate closed even if the check is green.
Do not count it as a permissible conditional CI skip. Wait for an actual completed review of
the current head; an older head's review, missing result, pending rerun, failed review, or
ambiguous/conflicting provider evidence cannot satisfy the gate.

Read all resulting feedback and refresh threads, approvals, head/base, and checks after that
completion. New findings return to the repair loop; completion alone does not clear them. A new
head invalidates the old completion evidence; a base change refreshes checks, and the shared
native-review procedure decides whether anything needs review. Retain the provider, reviewed SHA, completion URL/time, and finding
dispositions in the report or existing continuity notes. If completion cannot be established,
return `waiting` with the missing evidence and next observation or required trigger; never
silently waive the review because CI is green or no threads exist.

## All threads and outstanding reviews

Paginate the two connections separately so their independent cursors cannot hide later results:

```sh
gh api graphql --paginate --slurp -f owner="$OWNER" -f name="$REPO" -F number="$NUMBER" -f query='
query($owner: String!, $name: String!, $number: Int!, $endCursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      headRefOid baseRefOid isInMergeQueue isMergeQueueEnabled
      reviewThreads(first: 100, after: $endCursor) {
        totalCount pageInfo { hasNextPage endCursor }
        nodes { id isResolved isOutdated path line }
      }
    }
  }
}'
```

```sh
gh api graphql --paginate --slurp -f owner="$OWNER" -f name="$REPO" -F number="$NUMBER" -f query='
query($owner: String!, $name: String!, $number: Int!, $endCursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      headRefOid baseRefOid
      latestOpinionatedReviews(first: 100, after: $endCursor) {
        totalCount pageInfo { hasNextPage endCursor }
        nodes { id state url }
      }
    }
  }
}'
```

Require complete page traversal, matching totals, no partial GraphQL errors, and unchanged PR
head/base across pages and the final PR refresh. Every unresolved thread counts, including an
outdated one. Read full paginated comments for affected threads when repairing them; thread
metadata is insufficient to judge feedback. Read ordinary PR comments and review bodies too.

`REVIEW_REQUIRED` waits for the required reviewer. `CHANGES_REQUESTED` in GitHub's decision or
any latest opinionated review remains a blocker even when threads are resolved. `APPROVED`
cannot clear an unresolved thread. A null review decision (an empty string in `gh pr view` JSON)
may mean no required approvals; do not
invent one, and do not infer successful native code review from it.

An open PR in the merge queue is `waiting`. A queue admission or auto-merge response is never
completion. After the merge request, reload state, `mergedAt`, and `mergeCommit`; only the actual
merged state with those fields supports the `merged` outcome.

References: [Checks CLI](https://cli.github.com/manual/gh_pr_checks),
[checks pagination implementation](https://github.com/cli/cli/blob/trunk/pkg/cmd/pr/checks/checks.go),
[GraphQL pagination](https://cli.github.com/manual/gh_api),
[submitted reviews](https://docs.github.com/en/rest/pulls/reviews#list-reviews-for-a-pull-request),
[commit statuses](https://docs.github.com/en/rest/commits/statuses#list-commit-statuses-for-a-reference),
[check runs](https://docs.github.com/en/rest/checks/runs#list-check-runs-for-a-git-reference),
[CodeRabbit skipped-review causes](https://kb.coderabbit.ai/articles/1442026547-troubleshoot-why-coderabbit-reviews-might-not-trigger),
[PR review and merge states](https://docs.github.com/en/graphql/reference/pulls),
[protected merge command](https://cli.github.com/manual/gh_pr_merge).
