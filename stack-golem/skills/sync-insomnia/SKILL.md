---
name: sync-insomnia
description: Synchronize endpoint changes into a Git-Synced Insomnia YAML collection, commit the approved collection diff, and provide the manual Insomnia pull step.
model: haiku
allowed-tools: Read, Edit, Glob, Grep, Bash
---

# sync-insomnia

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

Locate the Git-Synced collection through `INSOMNIA_GIT_DIR`, edit only its YAML,
commit the approved diff, then tell the user to pull it from Insomnia.

## Step 0 — Preconditions

0. Read `../../shared/infra-map.md` — the single source of truth for machine-specific paths. Substitute its values wherever a step references `INSOMNIA_GIT_DIR`.
1. Verify Insomnia is installed (the `INSOMNIA_GIT_DIR` directory exists).
2. Verify the target collection has Git Sync enabled (a subdirectory in the git repos folder).
3. Verify `git` is available and the collection's git repo is clean or staged.

## Step 1 — Find the collection file

Run:

```bash
grep -r "url = " "<INSOMNIA_GIT_DIR — see infra-map>"/*/git/config
```

Parse the output to identify the correct repo directory. Then list the YAML files in that repo's git subfolder:

```bash
ls <repo-path>/git/*.yaml
```

Show the user which collection was found. If multiple collections exist, ask which one to edit.

## Step 2 — Read the collection

Read the target YAML file and show the user a summary:

- Collection name
- Existing folders and requests
- Existing ID and timestamp conventions

## Step 3 — Apply the requested mutation

Read [`references/collection-mutations.md`](references/collection-mutations.md), then
apply only the requested additions, modifications, or removals. Follow the collection's
observed conventions where they are stricter than the examples.

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
