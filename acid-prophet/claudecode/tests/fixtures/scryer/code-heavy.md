---
id: code-heavy-spec
status: draft
linear-project: _none_
verified-by: _none_
last-reviewed: 2026-05-04
---

# Code-heavy spec

This spec contains a fenced code block longer than 15 lines, which the
scryer should flag with a `[style]` info.

## Problem & Why

The current logger is verbose and noisy. We want a structured logger.

## Solution

Wrap pino with a small adapter that enforces our log shape.

## Architecture

A single `Logger` class exported from `src/lib/logger.ts`. All callers
use the singleton.

## Components

Below is the full intended implementation, which is exactly the kind of
content that should live in a Linear issue, not in the spec itself:

```ts
import pino from "pino";

type LogContext = {
  userId?: string;
  requestId?: string;
  service?: string;
};

class Logger {
  private p: pino.Logger;
  constructor(name: string) {
    this.p = pino({
      name,
      level: process.env.LOG_LEVEL ?? "info",
      formatters: {
        level: (label) => ({ level: label }),
        bindings: () => ({}),
      },
    });
  }

  info(msg: string, ctx: LogContext = {}) {
    this.p.info(ctx, msg);
  }

  warn(msg: string, ctx: LogContext = {}) {
    this.p.warn(ctx, msg);
  }

  error(msg: string, ctx: LogContext = {}) {
    this.p.error(ctx, msg);
  }
}

export const logger = new Logger("app");
```

## Error handling

- Logger initialization failure — fall back to console

## Testing

- Unit tests on the adapter

## Non-goals

- Log shipping (handled elsewhere)
- Per-request log sampling
