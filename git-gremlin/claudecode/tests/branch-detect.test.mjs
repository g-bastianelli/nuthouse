import { expect, test } from "bun:test";
import { detectBranchCreation } from "../hooks/branch-detect.mjs";

// --- commands that MUST be intercepted (branch creation) ---

test("git checkout -b", () => {
  expect(detectBranchCreation("git checkout -b feat-x")).toEqual({
    branch: "feat-x",
    kind: "checkout-b",
  });
});

test("git checkout -B (force create)", () => {
  expect(detectBranchCreation("git checkout -B feat-x")?.branch).toBe("feat-x");
});

test("git checkout -b with start point", () => {
  expect(detectBranchCreation("git checkout -b feat-x origin/main")?.branch).toBe("feat-x");
});

test("git switch -c", () => {
  expect(detectBranchCreation("git switch -c feat-x")).toEqual({
    branch: "feat-x",
    kind: "switch-c",
  });
});

test("git switch -C", () => {
  expect(detectBranchCreation("git switch -C feat-x")?.branch).toBe("feat-x");
});

test("git switch --create", () => {
  expect(detectBranchCreation("git switch --create feat-x")?.branch).toBe("feat-x");
});

test("git branch <new>", () => {
  expect(detectBranchCreation("git branch feat-x")).toEqual({
    branch: "feat-x",
    kind: "branch-create",
  });
});

test("git branch <new> <start>", () => {
  expect(detectBranchCreation("git branch feat-x main")?.branch).toBe("feat-x");
});

test("git branch -c (copy creates a branch)", () => {
  expect(detectBranchCreation("git branch -c old new")?.kind).toBe("branch-copy");
});

test("global option before subcommand: git -C path checkout -b", () => {
  expect(detectBranchCreation("git -C /repo checkout -b feat-x")?.branch).toBe("feat-x");
});

test("global config option: git -c user.name=x switch -c feat", () => {
  expect(detectBranchCreation("git -c user.name=x switch -c feat")?.branch).toBe("feat");
});

test("compound command: second segment creates branch", () => {
  expect(detectBranchCreation("git fetch && git checkout -b feat-x")?.branch).toBe("feat-x");
});

test("semicolon-separated branch creation", () => {
  expect(detectBranchCreation("cd /tmp; git switch -c feat")?.branch).toBe("feat");
});

test("quoted branch name", () => {
  expect(detectBranchCreation('git checkout -b "feat-x"')?.branch).toBe("feat-x");
});

// --- commands that MUST be allowed (no creation) ---

test("git checkout existing branch (no -b)", () => {
  expect(detectBranchCreation("git checkout main")).toBeNull();
});

test("git switch existing branch (no -c)", () => {
  expect(detectBranchCreation("git switch main")).toBeNull();
});

test("git branch (list)", () => {
  expect(detectBranchCreation("git branch")).toBeNull();
});

test("git branch -a (list all)", () => {
  expect(detectBranchCreation("git branch -a")).toBeNull();
});

test("git branch --show-current", () => {
  expect(detectBranchCreation("git branch --show-current")).toBeNull();
});

test("git branch -d (delete)", () => {
  expect(detectBranchCreation("git branch -d feat-x")).toBeNull();
});

test("git branch -D (force delete)", () => {
  expect(detectBranchCreation("git branch -D feat-x")).toBeNull();
});

test("git branch -m (rename)", () => {
  expect(detectBranchCreation("git branch -m old new")).toBeNull();
});

test("git branch --set-upstream-to", () => {
  expect(detectBranchCreation("git branch --set-upstream-to=origin/main")).toBeNull();
});

test("git worktree add is allowed (the sanctioned path)", () => {
  expect(detectBranchCreation("git worktree add ../wt feat-x")).toBeNull();
});

test("superset workspaces create is allowed", () => {
  expect(detectBranchCreation("superset workspaces create --branch feat-x")).toBeNull();
});

test("unrelated command", () => {
  expect(detectBranchCreation("ls -la")).toBeNull();
});

test("git status", () => {
  expect(detectBranchCreation("git status")).toBeNull();
});

test("empty / non-string", () => {
  expect(detectBranchCreation("")).toBeNull();
  expect(detectBranchCreation(undefined)).toBeNull();
  expect(detectBranchCreation(null)).toBeNull();
});
