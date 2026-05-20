---
id: missing-sections-spec
status: draft
linear-project: _none_
verified-by: _none_
last-reviewed: 2026-05-04
---

# Missing sections spec

This spec lacks the `Testing` and `Non-goals` sections.

## Problem & Why

We need to track user activity for analytics.

## Solution

Add an event ingest endpoint and a Postgres table to store events.

## Architecture

POST `/api/events` accepts a JSON payload. Events are written to
`activity_events(user_id, event_type, payload, ts)`.

## Components

- `EventController` — receives and validates payload
- `EventWriter` — writes to Postgres
- `EventSchema` — JSON schema validation

## Error handling

- Schema validation failure — 400 with field-level errors
- Postgres write failure — 503, no retry in handler
