import { expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dir, "..", "..", "..");
const auditorPrompt = fs.readFileSync(
  path.join(REPO_ROOT, "acid-prophet", "agents", "spec-auditor.md"),
  "utf8",
);

test("spec-auditor treats pre-handoff _none_ frontmatter as valid", () => {
  expect(auditorPrompt).toContain(
    "The sentinel value `_none_` is valid and non-empty for `linear-project` and `verified-by`",
  );
  expect(auditorPrompt).toContain("do not emit a BLOCKER for those values");
  expect(auditorPrompt).toContain("do not let them affect `handoff-eligible`");
});
