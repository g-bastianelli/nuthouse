---
id: stack-contradiction-spec
status: draft
linear-project: _none_
verified-by: _none_
last-reviewed: 2026-05-04
---

# Stack contradiction spec

This spec proposes a new npm dependency. The paired CLAUDE.md fixture
forbids new deps.

## Problem & Why

We need to format dates consistently across the UI.

## Solution

Add `date-fns` as a runtime dependency. Use it everywhere we render
dates.

## Architecture

Wrap `date-fns` in a small `formatters/date.ts` helper. All UI
components import from there.

## Components

- `formatters/date.ts` — wraps `date-fns/format`, `date-fns/parseISO`
- `formatters/relative.ts` — wraps `date-fns/formatDistance`

## Error handling

- Invalid date input — return the raw string unchanged

## Testing

- Unit tests for each formatter helper

## Non-goals

- Localization (not yet)
- Time zone support
