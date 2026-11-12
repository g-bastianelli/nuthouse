# Native Claude Code review

When the shared procedure calls for its implementation simplification pass, invoke the bundled
`/simplify` through the Skill tool in the current Claude session. Supply the exact allowed paths,
scoped staged/unstaged changes and untracked implementation files, relevant committed
`<verified-base-ref>...HEAD` changes, and behavior-preservation constraint as invocation guidance. Keep this
mutating pass in the caller's session so its existing Edit/Write grants remain available;
do not start a child `claude -p` session or change permission modes for cleanup.
Await completion and inspect the resulting diff; `/simplify` applies cleanup and does not
replace correctness review. Return to the caller's final checks and implementation commit before
the command below; reuse a completed pass as the shared procedure permits.

Use Claude Code's local `/code-review` (`/review` is an alias) with an explicit level and diff
range. The command reuses the last level and `--max-findings` typed anywhere, so omitting them
can silently run at `xhigh` and surface many uncertain findings:

```text
claude -p "/code-review high <verified-base-ref>...HEAD --max-findings default"
```

For later commits, target only the uncovered delivery commits after the shared procedure's
validated coverage anchor, excluding proven clean base merges:

```text
claude -p "/code-review high <coverage-anchor>..HEAD --max-findings default"
```

If no uncovered commits remain, reuse valid evidence without invoking review. Otherwise
noninteractive local review waits for completion. In an interactive session, await the local
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
