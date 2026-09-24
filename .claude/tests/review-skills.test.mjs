import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  checkBudget,
  checkSkill,
  parseSkill,
  reviewRepo,
} from "../skills/review-skills/scripts/check-skills.mjs";

const REPO_ROOT = path.resolve(import.meta.dir, "..", "..");

const VOICE = `## Voice

Read \`../../persona.md\` at the start of this skill. Its scope ends with the final report.
`;

function skill(frontmatter, body = VOICE) {
  return `---\n${frontmatter}\n---\n\n# x\n\n${body}`;
}

function ids(findings) {
  return findings.map((f) => f.id);
}

function run(text, overrides = {}) {
  return checkSkill({
    plugin: "cobaye",
    skillName: "write-thing",
    text,
    codex: true,
    files: ["SKILL.md"],
    readFile: () => "",
    knownSkills: new Set(["cobaye:write-thing", "cobaye:next"]),
    ...overrides,
  });
}

describe("parseSkill", () => {
  test("reads keys, quoted descriptions and block lists", () => {
    const parsed = parseSkill(
      skill('name: write-thing\ndescription: "Writes: things"\npaths:\n  - "**/*.ts"'),
    );
    expect(parsed.hasFrontmatter).toBe(true);
    expect(parsed.fields.name.value).toBe("write-thing");
    expect(parsed.fields.description.value).toBe("Writes: things");
    expect(parsed.fields.description.quoted).toBe(true);
    expect(parsed.keys).toEqual(["name", "description", "paths"]);
  });

  test("reports a missing frontmatter", () => {
    expect(parseSkill("# no frontmatter\n").hasFrontmatter).toBe(false);
  });
});

describe("checkSkill", () => {
  test("a clean workflow skill has no findings", () => {
    const findings = run(skill("name: write-thing\ndescription: Writes things. Use when asked."));
    expect(findings).toEqual([]);
  });

  test("flags name format, folder mismatch and reserved words", () => {
    expect(ids(run(skill("name: Write_Thing\ndescription: d")))).toContain("A01");
    expect(ids(run(skill("name: claude-thing\ndescription: d")))).toContain("A01");
    expect(ids(run(skill("name: other\ndescription: d")))).toContain("A02");
  });

  test("flags description length, markup and unquoted colon-space", () => {
    expect(ids(run(skill(`name: write-thing\ndescription: ${"x".repeat(1025)}`)))).toContain("A03");
    expect(ids(run(skill("name: write-thing\ndescription: uses <tags>")))).toContain("A03");
    expect(ids(run(skill("name: write-thing\ndescription: Writes: things")))).toContain("C03");
  });

  test("flags a missing frontmatter as a Codex load failure", () => {
    expect(ids(run("# x\n"))).toContain("C01");
  });

  test("flags invalid Claude Code values", () => {
    expect(ids(run(skill("name: write-thing\ndescription: d\ncontext: agent")))).toContain("A15");
    expect(ids(run(skill("name: write-thing\ndescription: d\nbackground: false")))).toContain(
      "A15",
    );
  });

  test("flags Codex pitfalls only on Codex plugins", () => {
    const text = skill(
      "name: write-thing\ndescription: d\ndisable-model-invocation: true\neffort: high",
      `${VOICE}\nStart from $ARGUMENTS.\n\n- Branch: !\`git branch\`\n`,
    );
    const codex = ids(run(text));
    expect(codex).toEqual(expect.arrayContaining(["C04", "C05", "C07", "C08"]));
    const claudeOnly = ids(run(text, { codex: false }));
    expect(claudeOnly).not.toContain("C04");
    expect(claudeOnly).not.toContain("C07");
  });

  test("accepts dynamic context carrying the fallback line", () => {
    const text = skill(
      "name: write-thing\ndescription: d",
      `${VOICE}\n> If the lines below still show raw, unexpanded dynamic-context commands, run them manually.\n\n- Branch: !\`git branch\`\n`,
    );
    expect(ids(run(text))).not.toContain("C08");
  });

  test("ignores a bang glued to a backtick, which Claude Code does not expand", () => {
    const text = skill(
      "name: write-thing\ndescription: d",
      `${VOICE}\nNever use non-null \`!\`.\n`,
    );
    expect(ids(run(text))).not.toContain("C08");
  });

  test("accepts an argument placeholder framed as the user's request", () => {
    const text = skill(
      "name: write-thing\ndescription: d",
      `${VOICE}\nStart from the user's request (\`$ARGUMENTS\`).\n`,
    );
    expect(ids(run(text))).not.toContain("C07");
  });

  test("resolves supporting-file links against the plugin root too", () => {
    const text = skill(
      "name: write-thing\ndescription: d",
      `${VOICE}\nRun \`scripts/records.mjs\`.\n`,
    );
    expect(ids(run(text, { pluginFileExists: () => true }))).not.toContain("A09");
  });

  test("keeps quoted user phrasings out of the non-English check", () => {
    const text = skill(
      "name: write-thing\ndescription: d",
      `${VOICE}\nFires on ("fais une recherche", "research X").\n`,
    );
    expect(ids(run(text))).not.toContain("N06");
  });

  test("flags raw agent dispatch without the runtime map", () => {
    const text = skill("name: write-thing\ndescription: d", `${VOICE}\nsubagent_type: 'x'\n`);
    expect(ids(run(text))).toContain("C09");
  });

  test("flags stray files and dangling supporting-file links", () => {
    const text = skill(
      "name: write-thing\ndescription: d",
      `${VOICE}\nRead \`references/missing.md\`.\n`,
    );
    const findings = ids(run(text, { files: ["SKILL.md", "README.md"] }));
    expect(findings).toContain("C10");
    expect(findings).toContain("A09");
  });

  test("flags a long reference without a table of contents", () => {
    const text = skill(
      "name: write-thing\ndescription: d",
      `${VOICE}\nRead \`references/big.md\`.\n`,
    );
    const findings = run(text, {
      files: ["SKILL.md", "references/big.md"],
      readFile: () => "# big\n" + "line\n".repeat(120),
    });
    expect(ids(findings)).toContain("A10");
  });

  test("checks agents/openai.yaml", () => {
    const text = skill("name: write-thing\ndescription: d");
    const yaml =
      'interface:\n  display_name: ""\n  default_prompt: "Do it"\npolicy:\n  allow_implicit_invocation: maybe\n';
    const findings = run(text, {
      files: ["SKILL.md", "agents/openai.yaml"],
      readFile: () => yaml,
    });
    expect(findings.filter((f) => f.id === "C11").length).toBeGreaterThanOrEqual(3);
  });

  test("enforces the house voice on workflow skills", () => {
    expect(ids(run(skill("name: write-thing\ndescription: d", "## Steps\n")))).toContain("N01");
    expect(
      ids(
        run(skill("name: write-thing\ndescription: d", "## Voice\n\nRead `../../persona.md`.\n")),
      ),
    ).toContain("N02");
  });

  test("flags emoji piles, non-English strings and dangling chains", () => {
    const text = skill(
      "name: write-thing\ndescription: d",
      `${VOICE}\nDone 🔥👑\n\nPrint _"la créature vit."_\n\n**REQUIRED SUB-SKILL:** Use \`cobaye:ghost\`\n`,
    );
    expect(ids(run(text))).toEqual(expect.arrayContaining(["N05", "N06", "N07"]));
  });

  test("exempts contracts from voice rules and rejects workflow sections in them", () => {
    const clean = skill("name: write-thing\ngenre: contract\ndescription: d", "## Rule group\n");
    expect(ids(run(clean))).not.toContain("N01");
    const dirty = skill("name: write-thing\ngenre: contract\ndescription: d", "## Voice\n");
    expect(run(dirty)).toContainEqual(expect.objectContaining({ id: "N13", severity: "CRITIQUE" }));
    const wordy = skill(`name: write-thing\ngenre: contract\ndescription: ${"x".repeat(351)}`, "");
    expect(ids(run(wordy))).toContain("N14");
  });
});

describe("checkBudget", () => {
  test("warns when Codex descriptions exceed the listing budget", () => {
    const many = Array.from({ length: 10 }, () => ({ codex: true, description: "x".repeat(900) }));
    expect(ids(checkBudget(many))).toEqual(["C12"]);
    expect(checkBudget(many.slice(0, 2))).toEqual([]);
  });
});

describe("reviewRepo", () => {
  test("reviews every plugin skill in this repository without crashing", () => {
    const report = reviewRepo(REPO_ROOT);
    expect(report.skills.length).toBeGreaterThan(30);
    for (const entry of report.skills) expect(entry.plugin).not.toBe(".claude");
  });
});

describe("review follow-ups", () => {
  test("parses block-scalar descriptions, inline comments and CRLF", () => {
    const folded = parseSkill(
      "---\nname: x\ndescription: >-\n  Writes things.\n  Use when asked.\neffort: high # tier\n---\nbody\n",
    );
    expect(folded.fields.description.value).toBe("Writes things. Use when asked.");
    expect(folded.fields.effort.value).toBe("high");
    const crlf = parseSkill("---\r\nname: x\r\ndescription: d\r\n---\r\nbody\r\n");
    expect(crlf.hasFrontmatter).toBe(true);
    expect(crlf.fields.name.value).toBe("x");
  });

  test("requires the plugin's own persona and ignores headings inside code fences", () => {
    const wrongPersona = skill(
      "name: write-thing\ndescription: d",
      "## Voice\n\nRead `../../../other/persona.md`; scope ends at the final report.\n",
    );
    expect(ids(run(wrongPersona))).toContain("N01");
    const fencedOnly = skill(
      "name: write-thing\ndescription: d",
      "```markdown\n## Voice\n\nRead `../../persona.md`; scope ends at the final report.\n```\n",
    );
    expect(ids(run(fencedOnly))).toContain("N01");
    const fencedContract = skill(
      "name: write-thing\ngenre: contract\ndescription: d",
      "```md\n## Workflow\n```\n",
    );
    expect(ids(run(fencedContract))).not.toContain("N13");
  });

  test("counts ./references links as linked", () => {
    const text = skill(
      "name: write-thing\ndescription: d",
      `${VOICE}\nSee [rules](./references/x.md).\n`,
    );
    expect(ids(run(text, { files: ["SKILL.md", "references/x.md"] }))).not.toContain("A09");
  });

  test("does not count a trailing newline as a body line", () => {
    const text = skill("name: write-thing\ndescription: d", VOICE + "line\n".repeat(493));
    const bodyLines = parseSkill(text).body.split("\n").length - 1;
    expect(bodyLines).toBe(499);
    expect(ids(run(text))).not.toContain("A06");
  });

  test("skips dotfiles and runs from a path with spaces", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "review skills "));
    const dir = path.join(root, "cobaye", "skills", "write-thing");
    fs.mkdirSync(path.join(root, "cobaye", ".claude-plugin"), { recursive: true });
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "SKILL.md"), skill("name: write-thing\ndescription: d"));
    fs.writeFileSync(path.join(dir, ".DS_Store"), "");
    const script = path.join(root, "check skills.mjs");
    fs.copyFileSync(
      path.join(REPO_ROOT, ".claude/skills/review-skills/scripts/check-skills.mjs"),
      script,
    );
    const out = execFileSync("node", [script, "--json", root], { encoding: "utf8" });
    const report = JSON.parse(out);
    expect(report.skills[0].findings.map((f) => f.id)).not.toContain("C10");
  });
});
