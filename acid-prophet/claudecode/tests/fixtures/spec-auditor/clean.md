---
id: clean-spec
status: draft
linear-project: _none_
verified-by: _none_
last-reviewed: 2026-05-04
---

# Clean spec

## Problem & Why

Users want to bookmark articles for later reading. Today bookmarks live
only in browser storage and are lost when devices change.

## Solution

Server-side bookmark store keyed by user account. Endpoints to list,
create, delete bookmarks. Sync at login.

## Architecture

REST endpoints under `/api/bookmarks`. Postgres table `bookmarks(user_id,
url, created_at)`. No new dependency.

## Components

- `BookmarkController` — handles HTTP routes
- `BookmarkRepository` — database access
- `BookmarkService` — business logic, deduplication

## Error handling

- Duplicate bookmark URL for the same user — return 200 with the existing
  record, do not error
- Database unreachable — return 503, no retry inside the request handler
- Invalid URL — return 400 with explicit field error

## Testing

Integration tests against a real Postgres instance. Unit tests for the
service layer with a fake repository.

## Non-goals

- Sharing bookmarks between users
- Tagging or folder organization
- Mobile push notifications on bookmark changes
