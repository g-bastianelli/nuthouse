import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  acquireProjectLock,
  inspectProjectLock,
  recoverProjectLock,
  releaseProjectLock,
} from "../lib/project-lock.mjs";

const temporaryDirectories = [];

function temporaryDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "maestro-lock-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("project reconciliation lock", () => {
  test("allows one owner and reports the existing owner to contenders", () => {
    const directory = temporaryDirectory();
    const first = acquireProjectLock({
      directory,
      projectId: "project-1",
      runId: "run-1",
      terminalId: "terminal-1",
      now: "2026-08-27T10:00:00.000Z",
    });
    const second = acquireProjectLock({
      directory,
      projectId: "project-1",
      runId: "run-2",
      terminalId: "terminal-2",
      now: "2026-08-27T10:00:01.000Z",
    });

    expect(first.acquired).toBe(true);
    expect(second).toMatchObject({
      acquired: false,
      reason: "LOCK_HELD",
      owner: { runId: "run-1", terminalId: "terminal-1" },
    });
  });

  test("only the matching token can release a lock", () => {
    const directory = temporaryDirectory();
    const lock = acquireProjectLock({ directory, projectId: "project-1", runId: "run-1" });
    expect(releaseProjectLock({ ...lock, token: "wrong" })).toEqual({
      released: false,
      reason: "TOKEN_MISMATCH",
    });
    expect(inspectProjectLock({ directory, projectId: "project-1" }).held).toBe(true);
    expect(releaseProjectLock(lock)).toEqual({ released: true });
    expect(inspectProjectLock({ directory, projectId: "project-1" }).held).toBe(false);
  });

  test("serializes token validation and removal against a contender", () => {
    const directory = temporaryDirectory();
    const lock = acquireProjectLock({ directory, projectId: "project-1", runId: "run-1" });
    let contender;

    expect(
      releaseProjectLock(lock, {
        onValidated() {
          contender = acquireProjectLock({
            directory,
            projectId: "project-1",
            runId: "run-2",
          });
        },
      }),
    ).toEqual({ released: true });
    expect(contender).toMatchObject({ acquired: false, reason: "LOCK_TRANSITION" });

    const next = acquireProjectLock({ directory, projectId: "project-1", runId: "run-2" });
    expect(next.acquired).toBe(true);
    expect(inspectProjectLock({ directory, projectId: "project-1" }).owner.token).toBe(next.token);
  });

  test("never recovers stale state automatically", () => {
    const directory = temporaryDirectory();
    const lock = acquireProjectLock({
      directory,
      projectId: "project-1",
      runId: "run-1",
      terminalId: "terminal-dead",
      now: "2026-08-27T08:00:00.000Z",
    });
    const inspection = inspectProjectLock({
      directory,
      projectId: "project-1",
      now: "2026-08-27T10:00:00.000Z",
      staleAfterMs: 60_000,
    });

    expect(inspection).toMatchObject({ held: true, staleCandidate: true });
    expect(
      recoverProjectLock({
        directory,
        projectId: "project-1",
        expectedToken: lock.token,
        ownerTerminalExists: true,
        now: "2026-08-27T10:00:00.000Z",
        staleAfterMs: 60_000,
      }),
    ).toEqual({ recovered: false, reason: "OWNER_STILL_EXISTS" });
    expect(
      recoverProjectLock({
        directory,
        projectId: "project-1",
        expectedToken: lock.token,
        ownerTerminalExists: false,
        now: "2026-08-27T10:00:00.000Z",
        staleAfterMs: 60_000,
      }),
    ).toEqual({ recovered: true });
  });

  test("refuses explicit recovery before the lock is stale", () => {
    const directory = temporaryDirectory();
    const lock = acquireProjectLock({
      directory,
      projectId: "project-1",
      runId: "run-1",
      terminalId: "terminal-dead",
      now: "2026-08-27T10:00:00.000Z",
    });

    expect(
      recoverProjectLock({
        directory,
        projectId: "project-1",
        expectedToken: lock.token,
        ownerTerminalExists: false,
        now: "2026-08-27T10:00:30.000Z",
        staleAfterMs: 60_000,
      }),
    ).toEqual({ recovered: false, reason: "LOCK_NOT_STALE" });
  });
});
