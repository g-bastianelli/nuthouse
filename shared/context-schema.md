# nuthouse session-store — context schema

One JSON file per session: `<PROJECT_ROOT>/.claude/nuthouse/sessions/<SESSION_ID>.json`

- **Writer** = the skill or agent that sets this key.
- **Readers** = skills or agents that consume the key.
- **Policy** = when the key is considered stale and must be re-fetched.

> **Concurrency note.** nuthouse skills are sequential within a session. Concurrent writes from two skills on the same session are not guarded — last write wins. This is acceptable; document here so callers are aware.

> **Git-sha validation in skills.** Skills without `Bash` in their `allowed-tools` cannot run `git rev-parse HEAD` to validate sha-based staleness. In that context, use `--fresh` to force a full re-fetch. The `session-store.mjs` utility (Node.js context) validates sha correctly via `getHeadSha()`.

> **Gitignore.** The session directory (`<PROJECT_ROOT>/.claude/nuthouse/sessions/`) contains ephemeral runtime data. Add it to `.gitignore` in user projects.

---

## `_meta` (injected automatically)

| Field | Type | Description |
|---|---|---|
| `session_id` | string | `$CLAUDE_SESSION_ID` — unique per conversation |
| `git_sha` | string | HEAD sha when the store was last written |
| `written_at` | string | ISO 8601 timestamp of last write |
| `_shas` | object | Per-key sha map for sha-tracked keys (see below) |

### `_meta._shas` — per-key sha tracking

Keys whose freshness depends on git state are recorded independently in `_meta._shas`:

| `_shas` entry | Tracked key | Why separate |
|---|---|---|
| `relevant_files` | `relevant_files` | Captured by greet; must not be invalidated by later writes (e.g. write-spec) that don't touch this key |
| `react-monkey.explorer_report` | `react-monkey.explorer_report` | Same: captured by react-monkey:implement; later merges must not clobber the sha |

`isStale(session, key, namespace, projectRoot)` always prefers `_meta._shas[fullKey]` over `_meta.git_sha` for these keys.

---

## Common keys (top-level)

| Key | Type | Writer | Readers | Freshness policy |
|---|---|---|---|---|
| `spec_path` | string (abs path) | `greet`, `write-spec` | `plan`, `create-project`, `check-drift` | Stale if file does not exist (`test -f`) |
| `relevant_files` | string[] (abs paths) | `greet` (via issue-context output) | `plan` → `plan-auditor`, `project-drafter` | Stale if `_meta._shas.relevant_files` ≠ `git rev-parse HEAD` |

---

## `linear-devotee` namespace

| Key | Type | Writer | Readers | Freshness policy |
|---|---|---|---|---|
| `issue` | object | _(reserved — always re-fetch from Linear)_ | — | Always stale |
| `plan_path` | string (abs path) | `plan` | `plan-auditor` | Stale if file does not exist |

---

## `acid-prophet` namespace

| Key | Type | Writer | Readers | Freshness policy |
|---|---|---|---|---|
| `handoff_spec` | `{ path, title, id }` | `write-spec` (at step 9 handoff) | `create-project` (step 0) | Stale if `_handoff_spec_path` ≠ `spec_path` |
| `_handoff_spec_path` | string (abs path) | `write-spec` | staleness check only | — |

---

## `react-monkey` namespace

| Key | Type | Writer | Readers | Freshness policy |
|---|---|---|---|---|
| `explorer_report` | object | `react-monkey:implement` | _(future)_ | Stale if `_meta._shas['react-monkey.explorer_report']` ≠ HEAD sha |

---

## Full schema example

```json
{
  "_meta": {
    "session_id": "ses_abc123",
    "git_sha": "a1b2c3d",
    "written_at": "2026-05-06T10:00:00.000Z",
    "_shas": {
      "relevant_files": "a1b2c3d"
    }
  },
  "spec_path": "/abs/path/to/docs/acid-prophet/specs/2026-05-06-my-feature.md",
  "relevant_files": [
    "/abs/path/to/shared/session-store.mjs",
    "/abs/path/to/linear-devotee/claudecode/skills/greet/SKILL.md"
  ],
  "linear-devotee": {
    "plan_path": "/abs/path/to/docs/linear-devotee/plan/ENG-247.md"
  },
  "acid-prophet": {
    "handoff_spec": {
      "path": "/abs/path/to/docs/acid-prophet/specs/2026-05-06-my-feature.md",
      "title": "my feature",
      "id": "my-feature"
    },
    "_handoff_spec_path": "/abs/path/to/docs/acid-prophet/specs/2026-05-06-my-feature.md"
  },
  "react-monkey": {
    "explorer_report": {}
  }
}
```
