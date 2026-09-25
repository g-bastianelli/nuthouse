# Greet context cache

Read this only when retaining a resolved issue brief for planning or session recovery.

When plugin data storage exists, write `greet-<ISSUE_ID>.json` there:

```json
{
  "issue_id": "<ID>",
  "issue_title": "<title>",
  "linear_project_id": "<project id | _none_>",
  "issue_context_brief": "<markdown>",
  "spec_file": "<absolute path | _none_>",
  "project_plan": "<absolute path | _none_>",
  "relevant_files": ["<absolute existing path>"],
  "project_root": "<absolute repository root>",
  "branch": "<current branch>",
  "status": "<name> (<type>)",
  "created_at": "<actual ISO timestamp>"
}
```

Update existing runtime session state with `greeted: true` and the resolved context while
preserving unrelated fields. Keep this one cache; do not mirror it into another store. A
missing cache is recoverable from the current brief and authoritative sources, never a
reason to restart an interview after compaction.
