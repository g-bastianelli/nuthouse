# Native Claude Code review

Use Claude Code's local `/code-review` (`/review` is an alias) with an explicit diff range:

```text
claude -p "/code-review <verified-base-ref>...HEAD"
```

Noninteractive local review waits for completion. In an interactive session, await the local
background review's actual findings before continuing. With no range, a pushed branch can have
no commits ahead of its upstream and miss the PR diff. Capture HEAD and the fetched base OID
before review and compare them afterward.

Leave automatic `--fix` and external `--comment` posting off: the delivery owner adjudicates
findings, fixes scoped defects, and publishes verified replies through the comment workflow.
The native result may be prose inside a successful JSON envelope; neither exit zero nor
`is_error: false` means no defects. There is no assumed machine-readable findings schema.

Do not select cloud `ultrareview` as a fallback. It is a separate billable workflow, and some
noninteractive variants return before review finishes. Use it only if the caller explicitly
chose it with an understood completion path. Missing or failed local review returns a concrete
blocker without a custom reviewer agent substitution.

References: [Local code review](https://code.claude.com/docs/en/code-review#review-a-diff-locally),
[Ultrareview](https://code.claude.com/docs/en/ultrareview).
