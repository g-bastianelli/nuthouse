import { expect, test } from "bun:test";
import { detectBranchCreation } from "../claudecode/hooks/branch-detect.mjs";

test.each([
  ["git checkout -b feat-x", "feat-x", "checkout-b"],
  ["git checkout -B feat-x", "feat-x", "checkout-b"],
  ["git checkout -b feat-x origin/main", "feat-x", "checkout-b"],
  ["git switch -c feat-x", "feat-x", "switch-c"],
  ["git switch -C feat-x", "feat-x", "switch-c"],
  ["git switch --create feat-x", "feat-x", "switch-c"],
  ["git branch feat-x", "feat-x", "branch-create"],
  ["git branch feat-x main", "feat-x", "branch-create"],
  ["git branch -c old new", "old", "branch-copy"],
  ["git -C /repo checkout -b feat-x", "feat-x", "checkout-b"],
  ["git -c user.name=x switch -c feat", "feat", "switch-c"],
  ["git fetch && git checkout -b feat-x", "feat-x", "checkout-b"],
  ["cd /tmp; git switch -c feat", "feat", "switch-c"],
  ['git checkout -b "feat-x"', "feat-x", "checkout-b"],
])("detects branch creation: %s", (command, branch, kind) => {
  expect(detectBranchCreation(command)).toEqual({ branch, kind });
});

test.each([
  "git checkout main",
  "git switch main",
  "git branch",
  "git branch -a",
  "git branch --show-current",
  "git branch -d feat-x",
  "git branch -D feat-x",
  "git branch -m old new",
  "git branch --set-upstream-to=origin/main",
  "git worktree add ../wt feat-x",
  "superset workspaces create --branch feat-x",
  "ls -la",
  "git status",
  "",
])("allows non-creation: %s", (command) => {
  expect(detectBranchCreation(command)).toBeNull();
});

test("allows non-string input", () => {
  expect(detectBranchCreation(undefined)).toBeNull();
  expect(detectBranchCreation(null)).toBeNull();
});
