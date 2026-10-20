# Native Claude Code review

With scoped implementation or cleanup authority, invoke the bundled `/simplify` through the
Skill tool in the current Claude session, targeting `<verified-base-ref>...HEAD`. Supply the
exact allowed paths and behavior-preservation constraint as invocation guidance. Keep this
mutating pass in the caller's session so its existing Edit/Write grants remain available;
do not start a child `claude -p` session or change permission modes for cleanup.
Await completion and inspect the resulting diff; `/simplify` applies cleanup and does not
replace correctness review. Verify and commit accepted edits before the command below.

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

References: [Bundled commands including simplify](https://code.claude.com/docs/en/commands),
[Local code review](https://code.claude.com/docs/en/code-review#review-a-diff-locally),
[Ultrareview](https://code.claude.com/docs/en/ultrareview).
