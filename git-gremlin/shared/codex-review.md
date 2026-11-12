# Native Codex review

When the shared procedure calls for its implementation simplification pass, work in the active
Codex session over the supplied scoped staged, unstaged, and untracked implementation changes,
plus the relevant `<verified-base-ref>...HEAD` changes already committed: reuse existing helpers, remove
unnecessary complexity and redundant work, and preserve observable behavior and Acceptance.
Inspect surrounding code only as needed; edit only authorized delivery paths. This is an
implementation pass, not the independent native review. Do not assume a built-in `/simplify`
command or require another runtime. Return to the caller's final checks and implementation
commit before review below; reuse a completed pass as the shared procedure permits.

Use the current runtime's built-in review facility. From the issue workspace, review against
the fetched and verified base ref:

```text
codex review --base <verified-base-ref>
```

For later commits, use the validated coverage anchor from the shared procedure as the base,
so one run covers every uncovered delivery commit without including proven clean base merges:

```text
codex review --base <coverage-anchor-oid>
```

If the shared procedure establishes zero uncovered commits, reuse its valid evidence without
running this command. Otherwise await completion and read the findings. Do not combine `--base` with a positional custom review
prompt; these are alternative targets. `--uncommitted` alone does not review the published PR
diff. A pushed branch still needs the explicit base.

Capture HEAD before review and compare it afterward; dirty changes or a head that moved during
review invalidate the result. If the native
command is unavailable or cannot complete, return the concrete review blocker. Do not silently
replace it with the implementing agent's self-review or a new custom reviewer agent.

Success means the command completed. Findings may still be present in a successful response;
adjudicate their content and retain the result in the delivery context. Follow the shared native-review
procedure's repair, target, and stop rules before another pass.

Reference: [Codex CLI reference](https://learn.chatgpt.com/docs/cli/reference).
