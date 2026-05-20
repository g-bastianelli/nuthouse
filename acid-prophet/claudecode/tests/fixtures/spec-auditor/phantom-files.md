---
id: phantom-files-spec
status: draft
linear-project: _none_
verified-by: _none_
last-reviewed: 2026-05-04
---

# Phantom files spec

This spec references files that do not exist in the repo.

## Problem & Why

We want to refactor the auth flow for clarity.

## Solution

Move auth handling into a dedicated module.

## Architecture

The new module lives at `src/does-not-exist.ts` and is imported by
`src/also-not-here.tsx` from the existing `src/api/legacy.ts` (this
last one is intentionally a real path that does not exist either, to
test phantom detection).

## Components

- `src/does-not-exist.ts` — new auth utilities (does not exist yet)
- `src/also-not-here.tsx` — auth UI shell (does not exist yet)

## Error handling

- Auth failure → redirect to login

## Testing

- Integration tests covering the new flow

## Non-goals

- Replacing the existing OAuth providers
