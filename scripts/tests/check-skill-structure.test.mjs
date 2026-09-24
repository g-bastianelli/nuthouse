import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkSkillStructure } from "../check-skill-structure.mjs";

const roots = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nuthouse-skills-"));
  roots.push(root);
  for (const [filename, content] of Object.entries(files)) {
    const target = path.join(root, filename);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return root;
}

describe("checkSkillStructure", () => {
  test("accepts a concise entrypoint with a directly routed reference", () => {
    const root = fixture({
      "plugin/skills/demo/SKILL.md": "See [forms](references/forms.md) when editing forms.\n",
      "plugin/skills/demo/references/forms.md": "# Forms\n\nRules.\n",
    });

    expect(checkSkillStructure(root)).toEqual([]);
  });

  test("reports oversized entrypoints, hidden references, and broken links", () => {
    const root = fixture({
      "plugin/skills/demo/SKILL.md": `${"rule\n".repeat(501)}[missing](references/missing.md)\n`,
      "plugin/skills/demo/references/forms.md": "# Forms\n",
      "plugin/skills/demo/references/deep/details.md": "# Details\n",
    });

    expect(checkSkillStructure(root)).toEqual([
      "plugin/skills/demo/SKILL.md: 502 lines exceeds the 500-line entrypoint limit",
      "plugin/skills/demo/SKILL.md: broken supporting-reference link references/missing.md",
      "plugin/skills/demo/references/deep/details.md: keep supporting references one level below SKILL.md",
      "plugin/skills/demo/references/deep/details.md: not routed directly from plugin/skills/demo/SKILL.md",
      "plugin/skills/demo/references/forms.md: not routed directly from plugin/skills/demo/SKILL.md",
    ]);
  });

  test("requires navigation in long references", () => {
    const root = fixture({
      "plugin/skills/demo/SKILL.md": "Read `references/long.md`.\n",
      "plugin/skills/demo/references/long.md": "line\n".repeat(101),
    });

    expect(checkSkillStructure(root)).toEqual([
      "plugin/skills/demo/references/long.md: references over 100 lines need a contents section",
    ]);
  });
});
