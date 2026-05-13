import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildAdditionalContext,
  findPersonas,
  main,
  parseFrontmatter,
  pickPersona,
} from "../persona-roulette.mjs";

const SILENT_STDERR = { write: () => {} };

describe("parseFrontmatter", () => {
  test("parses valid frontmatter + body", () => {
    const content = `---\nname: test\ntagline: a tag\nemoji: 🔥\n---\n\nThe body.`;
    const result = parseFrontmatter(content);
    expect(result).toEqual({
      name: "test",
      tagline: "a tag",
      emoji: "🔥",
      body: "The body.",
    });
  });

  test("strips quotes around values", () => {
    const content = `---\nname: "test"\ntagline: 'a tag'\n---\n\nBody.`;
    const result = parseFrontmatter(content);
    expect(result.name).toBe("test");
    expect(result.tagline).toBe("a tag");
  });

  test("returns null when name is missing", () => {
    const content = `---\ntagline: a tag\n---\n\nBody.`;
    expect(parseFrontmatter(content)).toBeNull();
  });

  test("returns null when body is empty", () => {
    const content = `---\nname: test\n---\n\n`;
    expect(parseFrontmatter(content)).toBeNull();
  });

  test("returns null when no opening delimiter", () => {
    expect(parseFrontmatter("Just some text")).toBeNull();
  });

  test("returns null when frontmatter not closed", () => {
    expect(parseFrontmatter("---\nname: test\nbody")).toBeNull();
  });

  test("handles values containing colons (only first colon splits)", () => {
    const content = `---\nname: test\ntagline: simp: devoted\n---\n\nBody.`;
    const result = parseFrontmatter(content);
    expect(result.tagline).toBe("simp: devoted");
  });
});

describe("findPersonas", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "persona-roulette-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("finds persona.md in subdirectories", () => {
    fs.mkdirSync(path.join(tmpDir, "plugin-a"));
    fs.mkdirSync(path.join(tmpDir, "plugin-b"));
    fs.writeFileSync(path.join(tmpDir, "plugin-a", "persona.md"), "---\nname: a\n---\n\nBody A.");
    fs.writeFileSync(path.join(tmpDir, "plugin-b", "persona.md"), "---\nname: b\n---\n\nBody B.");

    const personas = findPersonas(tmpDir, { stderr: SILENT_STDERR });
    expect(personas).toHaveLength(2);
    expect(personas.map((p) => p.name).sort()).toEqual(["a", "b"]);
  });

  test("skips invalid frontmatter, keeps valid ones", () => {
    fs.mkdirSync(path.join(tmpDir, "plugin-a"));
    fs.mkdirSync(path.join(tmpDir, "plugin-b"));
    fs.writeFileSync(path.join(tmpDir, "plugin-a", "persona.md"), "no frontmatter");
    fs.writeFileSync(path.join(tmpDir, "plugin-b", "persona.md"), "---\nname: b\n---\n\nBody B.");

    const personas = findPersonas(tmpDir, { stderr: SILENT_STDERR });
    expect(personas).toHaveLength(1);
    expect(personas[0].name).toBe("b");
  });

  test("returns empty array when no subdir has persona.md", () => {
    fs.mkdirSync(path.join(tmpDir, "plugin-a"));
    expect(findPersonas(tmpDir, { stderr: SILENT_STDERR })).toEqual([]);
  });

  test("ignores hidden directories", () => {
    fs.mkdirSync(path.join(tmpDir, ".claude"));
    fs.writeFileSync(path.join(tmpDir, ".claude", "persona.md"), "---\nname: hidden\n---\n\nBody.");
    expect(findPersonas(tmpDir, { stderr: SILENT_STDERR })).toEqual([]);
  });

  test("returns empty when repoRoot does not exist", () => {
    expect(findPersonas("/nonexistent/path", { stderr: SILENT_STDERR })).toEqual([]);
  });

  test("writes warning to stderr for invalid file", () => {
    fs.mkdirSync(path.join(tmpDir, "plugin-a"));
    fs.writeFileSync(path.join(tmpDir, "plugin-a", "persona.md"), "no frontmatter");

    let warning = "";
    const stderr = {
      write: (s) => {
        warning += s;
      },
    };
    findPersonas(tmpDir, { stderr });
    expect(warning).toContain("skipping");
    expect(warning).toContain("persona.md");
  });
});

describe("pickPersona", () => {
  test("picks first persona when rng returns 0", () => {
    const personas = [{ name: "a" }, { name: "b" }, { name: "c" }];
    expect(pickPersona(personas, () => 0).name).toBe("a");
  });

  test("picks middle persona when rng returns 0.5", () => {
    const personas = [{ name: "a" }, { name: "b" }, { name: "c" }];
    expect(pickPersona(personas, () => 0.5).name).toBe("b");
  });

  test("picks last persona when rng returns 0.99", () => {
    const personas = [{ name: "a" }, { name: "b" }, { name: "c" }];
    expect(pickPersona(personas, () => 0.99).name).toBe("c");
  });

  test("returns null for empty array", () => {
    expect(pickPersona([], () => 0)).toBeNull();
  });
});

describe("buildAdditionalContext", () => {
  test("includes EXTREMELY-IMPORTANT wrapper, name, tagline, body", () => {
    const persona = { name: "test", tagline: "a tag", body: "You are test." };
    const ctx = buildAdditionalContext(persona);
    expect(ctx).toContain("<EXTREMELY-IMPORTANT>");
    expect(ctx).toContain("</EXTREMELY-IMPORTANT>");
    expect(ctx).toContain("**test**");
    expect(ctx).toContain("(a tag)");
    expect(ctx).toContain("You are test.");
    expect(ctx).toContain("default voice");
  });

  test("handles missing tagline gracefully", () => {
    const persona = { name: "test", body: "Body." };
    const ctx = buildAdditionalContext(persona);
    expect(ctx).toContain("**test**");
    expect(ctx).not.toContain("()");
  });
});

describe("main", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "persona-roulette-main-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function setupPersonas() {
    fs.mkdirSync(path.join(tmpDir, "plugin-a"));
    fs.mkdirSync(path.join(tmpDir, "plugin-b"));
    fs.writeFileSync(
      path.join(tmpDir, "plugin-a", "persona.md"),
      "---\nname: a\ntagline: t-a\n---\n\nBody A.",
    );
    fs.writeFileSync(
      path.join(tmpDir, "plugin-b", "persona.md"),
      "---\nname: b\ntagline: t-b\n---\n\nBody B.",
    );
  }

  test("writes valid JSON to stdout when personas exist", () => {
    setupPersonas();
    let written = "";
    const stdout = {
      write: (s) => {
        written += s;
      },
    };

    main({
      repoRoot: tmpDir,
      env: {},
      rng: () => 0,
      stdout,
      stderr: SILENT_STDERR,
    });

    const parsed = JSON.parse(written);
    expect(parsed.hookSpecificOutput.hookEventName).toBe("SessionStart");
    expect(parsed.hookSpecificOutput.additionalContext).toContain("<EXTREMELY-IMPORTANT>");
    expect(parsed.hookSpecificOutput.additionalContext).toContain("Body A.");
  });

  test("opt-out via SKILL_ISSUE_PERSONA=off → silent exit", () => {
    setupPersonas();
    let written = "";
    const stdout = {
      write: (s) => {
        written += s;
      },
    };

    main({
      repoRoot: tmpDir,
      env: { SKILL_ISSUE_PERSONA: "off" },
      rng: () => 0,
      stdout,
      stderr: SILENT_STDERR,
    });

    expect(written).toBe("");
  });

  test("no persona files → silent exit", () => {
    let written = "";
    const stdout = {
      write: (s) => {
        written += s;
      },
    };

    main({
      repoRoot: tmpDir,
      env: {},
      rng: () => 0,
      stdout,
      stderr: SILENT_STDERR,
    });

    expect(written).toBe("");
  });

  test("all persona files invalid → silent exit", () => {
    fs.mkdirSync(path.join(tmpDir, "plugin-a"));
    fs.writeFileSync(path.join(tmpDir, "plugin-a", "persona.md"), "broken");

    let written = "";
    const stdout = {
      write: (s) => {
        written += s;
      },
    };

    main({
      repoRoot: tmpDir,
      env: {},
      rng: () => 0,
      stdout,
      stderr: SILENT_STDERR,
    });

    expect(written).toBe("");
  });

  test("different rng values pick different personas", () => {
    setupPersonas();
    const written = [];

    for (const r of [0, 0.99]) {
      let buf = "";
      const stdout = {
        write: (s) => {
          buf += s;
        },
      };
      main({
        repoRoot: tmpDir,
        env: {},
        rng: () => r,
        stdout,
        stderr: SILENT_STDERR,
      });
      written.push(JSON.parse(buf).hookSpecificOutput.additionalContext);
    }

    expect(written[0]).toContain("Body A.");
    expect(written[1]).toContain("Body B.");
  });
});
