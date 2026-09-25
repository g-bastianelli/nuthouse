# Issue-delivery checklist gate

Use only when the caller supplies named `PLAN_FILE`, `SPEC_FILE`, and `DRIFT_EVIDENCE`.

1. Require all three absolute paths to exist and be readable. Never reconstruct an artifact from
   conversation prose.
2. Require the plan status to be validated and drift evidence status to be `clean`. A missing or
   blocked report stops generation.
3. Continue through the ordinary extraction, draft, and user review using the explicit spec. This
   mode does not skip review, check an item, or accept the feature.
4. Write an accepted checklist with `status: open` and record plan, spec, and drift paths.
5. Return:

   ```text
   CHECKLIST_EVIDENCE: { path: <absolute checklist path>, status: open }
   ```

Manual feature acceptance and merge remain outside this skill.
