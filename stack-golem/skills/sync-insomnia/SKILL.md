---
name: sync-insomnia
description: Use when adding, modifying, or removing API endpoints and the corresponding Insomnia collection needs to be updated. Edits the Git-Synced YAML collection directly, commits, and tells the user to Pull in Insomnia.
allowed-tools: Read
---

# sync-insomnia

## Voice

Read `../../persona.md` at the start of this skill. That persona is
canonical for all output of this skill. Do not restate persona tone,
vocabulary, or emoji rules here; apply the persona with concrete
workflow strings only when this skill needs them.

**Scope:** local to this skill's execution only. Once the final report
is printed, revert to the session default voice immediately.
Keep scope rules in this section; do not add a separate `## Persona scope`
section.

This skill is **rigid** — execute steps in order.

## Language

Adapt all output to match the user's language. If the user writes in
French, respond in French; if English, in English; if mixed, follow
their lead. Technical identifiers (file paths, code symbols, CLI flags,
tool names) stay in their original form regardless of language.

## When you're invoked

Use this skill when:

- Adding, modifying, or removing HTTP endpoints in an Insomnia collection
- The collection uses Git Sync
- Changes need to be synced between local edits and Insomnia

The skill locates the Insomnia Git repository on disk (macOS: `~/Library/Application Support/Insomnia/version-control/git/`), edits the YAML collection directly, commits the changes, and tells you to Pull in Insomnia's Git Sync panel.

## Step 0 — Preconditions

1. Verify Insomnia is installed (directory exists: `~/Library/Application Support/Insomnia/version-control/git/`).
2. Verify the target collection has Git Sync enabled (a subdirectory in the git repos folder).
3. Verify `git` is available and the collection's git repo is clean or staged.

## Step 1 — Find the collection file

Run:

```bash
grep -r "url = " ~/Library/Application\ Support/Insomnia/version-control/git/*/git/config
```

Parse the output to identify the correct repo directory. Then list the YAML files in that repo's git subfolder:

```bash
ls <repo-path>/git/*.yaml
```

Show the user which collection was found. If multiple collections exist, ask which one to edit.

## Step 2 — Read and understand the structure

Read the target YAML file and show the user a summary:

- Collection name
- Existing folders and requests
- ID generation pattern (prefixes: `req_`, `fld_`, `jar_`, `env_`)

## Step 3 — Add, modify, or remove entries

Based on the user's request:

- **Add a new request**: generate a new `req_<hex32>` ID, add the request entry with all required fields (url, method, name, meta, headers, body if needed).
- **Modify an existing request**: locate the entry, update url/method/headers/body as needed.
- **Remove a request**: delete the entry from the collection array.

Important YAML rules:

- `sortKey` is always required — use negative timestamp (e.g., `node -e "console.log(-Date.now())"`)
- `created` and `modified` are Unix timestamps in milliseconds
- `Content-Type` header only for requests with a body
- Bearer auth uses `Authorization: Bearer {{token}}`

Show the user the changes before committing.

## Step 4 — Commit the changes

```bash
cd <repo-path>/git
git add <collection>.yaml
git commit -m "feat(insomnia): <description>"
```

Confirm the commit succeeded.

## Step 5 — Tell the user to Pull

Output a clear message:

```
Changes committed. Now open Insomnia, navigate to the Git Sync panel,
and click **Pull** to load the updated collection.
```

## Final report

```
stack-golem:sync-insomnia report
  Collection:   <collection name>
  Changes:      <summary: N adds, M modifies, K removes>
  Commit:       <short sha> — <message>
  Next step:    Pull in Insomnia Git Sync panel
```

## Hard rules

- Never `git commit`, `git push`, or `git rebase` in any other repo without explicit user consent.
- Verify collection path before reading/writing YAML.
- Always show the user the diff before committing.
- Do not edit the collection YAML if git status is dirty outside the target file.
- Never auto-pull in Insomnia — the user must do it manually via the Git Sync panel.
