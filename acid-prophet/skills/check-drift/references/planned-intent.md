# Planned-intent drift

1. Require readable absolute `PLAN_FILE` and `SPEC_FILE`; never reconstruct them from conversation
   prose.
2. Compare plan Files, Acceptance traceability, Steps, Verify, Risks, and Out of scope against the
   spec's Problem/Solution, Architecture, Constraints, Error handling, active Acceptance, Testing
   approach, and Non-goals.
3. Classify every active criterion and normative constraint. A plan/spec conflict is `DRIFT`;
   missing evidence is `AMBIGUOUS`.
4. Write only a compact JSON report to
   `${CLAUDE_PLUGIN_DATA}/issue-delivery-drift-<plan-slug>.json`. Include paths, source/plan
   versions, stable findings, counts, and `status: clean | blocked`; exclude prompts, source bodies,
   Linear bodies, secrets, and full logs.
5. Any `DRIFT` or `AMBIGUOUS` finding makes the status `blocked`. Return exactly:

   ```text
   DRIFT_EVIDENCE: { path: <absolute report path>, status: <clean | blocked> }
   ```

Do not patch, offer a PR comment, start implementation, or continue into development mode.
