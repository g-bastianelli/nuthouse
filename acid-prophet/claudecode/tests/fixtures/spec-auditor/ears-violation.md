---
id: ears-violation-spec
status: draft
linear-project: _none_
verified-by: _none_
last-reviewed: 2026-05-04
---

# EARS violation spec

This spec includes an `Acceptance` section whose bullets do not follow
EARS syntax.

## Problem & Why

We need an export feature for user data.

## Solution

A button that triggers a download of the user's data as JSON.

## Architecture

`/api/export` returns a stream of JSON. The frontend exposes a button
that hits the endpoint and triggers the browser download.

## Components

- `ExportController` — endpoint
- `ExportButton` — UI

## Error handling

- Server error → toast notification

## Testing

- Integration tests on the endpoint

## Acceptance

- The button works
- Users can download their data
- The file is named appropriately

## Non-goals

- Scheduled or recurring exports
- CSV format (V2)
