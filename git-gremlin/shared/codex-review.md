# Native Codex review

Use the current runtime's built-in review facility. From the issue workspace, review against
the fetched and verified base ref:

```text
codex review --base <verified-base-ref>
```

Await completion and read the findings. Do not combine `--base` with a positional custom review
prompt; these are alternative targets. `--uncommitted` alone does not review the published PR
diff. A pushed branch still needs the explicit base.

Capture HEAD and base before review and compare both afterward. Local review must cover exactly
the scope about to merge; dirty changes or a moving ref invalidate that assumption. If the native
command is unavailable or cannot complete, return the concrete review blocker. Do not silently
replace it with the implementing agent's self-review or a new custom reviewer agent.

Success means the command completed. Findings may still be present in a successful response;
adjudicate their content and retain the result in the delivery context. Follow the calling skill's
repair and scope rules before another pass.

Reference: [Codex CLI reference](https://learn.chatgpt.com/docs/cli/reference).
