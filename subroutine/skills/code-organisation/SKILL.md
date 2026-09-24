---
name: code-organisation
genre: contract
description: Code-organisation discipline for TypeScript — named exports, declarative entry points, one responsibility per file, explicit package boundaries, reuse before writing, and comments that state only a non-obvious why. Applies while editing TypeScript and requires check-folder-shape after structural changes, before verification.
user-invocable: false
paths: ["**/*.ts", "**/*.tsx"]
---

# subroutine — code-organisation discipline

For every TypeScript module; read the nearest `AGENTS.md` first.

## Shape modules around responsibilities

- Named exports; a default export only when a tool config requires it.
- One responsibility per file, named specifically (`partition.ts`), never
  a `utils.ts`/`helpers.ts` dumping ground.
- Group resources into owner folders; colocate tests and private support.

## Keep entry points declarative

`index.ts` holds only declarative composition or named re-exports. Branching,
loops, I/O, side effects, and business logic live in named files. Declare a
library's public subpaths in `package.json#exports`, not a barrel exposing
every module.

## Preserve readable code and boundaries

- `function` declarations for top-level functions and React components; arrows
  for callbacks and inline expressions.
- Prefer small autonomous libraries with explicit runtime/layer direction over
  catch-all `shared`/`utils` packages that hide ownership.
- Search the repo and shared packages first; reuse established abstractions.

## Comment only a non-obvious why

Keep it to one or two lines; API/framework trap warnings qualify. No bug story
(the commit holds it), no paraphrase of the code, no multi-paragraph block in
JSX. Matching the surrounding comment density never licenses narration.

## Check the settled folder

After structural edits, before verification/completion, review the settled tree
and unchanged siblings.

**REQUIRED SUB-SKILL:** Use `subroutine:check-folder-shape`
