#!/usr/bin/env node
// Mechanical pass of review-skills: every rule tagged `mech` in ../references/rules.md.
// Judgment rules stay with the reviewers; this file only decides what a regex can.
//
// Usage: node check-skills.mjs [--json] [repo-root]

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const CLAUDE_ONLY_KEYS = [
  "paths",
  "user-invocable",
  "allowed-tools",
  "disallowed-tools",
  "context",
  "agent",
  "background",
  "model",
  "effort",
  "argument-hint",
  "arguments",
  "hooks",
  "shell",
  "when_to_use",
];
const BOOLEAN_KEYS = ["disable-model-invocation", "user-invocable", "background"];
const BOOLEAN_WORDS = new Set(["true", "false", "yes", "no", "on", "off", "1", "0"]);
const EFFORTS = new Set(["low", "medium", "high", "xhigh", "max"]);
// Codex lists skills in 2% of the context window, 8 000 chars when the window is unknown.
const CODEX_LISTING_BUDGET = 8000;
// A contract description rides along in the hook's session digest.
const CONTRACT_DESCRIPTION_MAX = 350;
const NON_ENGLISH = /[àâçéèêëîïôûùüÿœ]/i;
const PICTOGRAPH = /\p{Extended_Pictographic}/gu;

function unquote(raw) {
  const t = raw.trim();
  if (t.length >= 2 && (t[0] === '"' || t[0] === "'") && t.at(-1) === t[0]) {
    return { value: t.slice(1, -1), quoted: true };
  }
  // In YAML an unquoted ` #` starts a comment.
  return { value: t.replace(/\s+#.*$/, ""), quoted: false };
}

// A `>` or `|` scalar continues on the indented lines that follow it.
function blockScalar(indicator, lines) {
  const text = lines.map((l) => l.trim());
  return indicator.startsWith(">") ? text.filter(Boolean).join(" ") : text.join("\n");
}

/** Split a SKILL.md into top-level frontmatter fields and body. */
export function parseSkill(raw) {
  const text = raw.replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n"))
    return { hasFrontmatter: false, fields: {}, keys: [], body: text, bodyLine: 1 };
  const end = text.indexOf("\n---", 4);
  if (end === -1) return { hasFrontmatter: false, fields: {}, keys: [], body: text, bodyLine: 1 };
  const fields = {};
  const keys = [];
  const lines = text.slice(4, end).split("\n");
  lines.forEach((line, i) => {
    const m = line.match(/^([A-Za-z_][\w-]*):(.*)$/);
    if (!m) return;
    keys.push(m[1]);
    const indicator = m[2].trim();
    if (/^[>|][+-]?$/.test(indicator)) {
      const rest = lines.slice(i + 1);
      const stop = rest.findIndex((l) => l.trim() && !/^\s/.test(l));
      const block = stop === -1 ? rest : rest.slice(0, stop);
      fields[m[1]] = { value: blockScalar(indicator, block), quoted: true };
    } else {
      fields[m[1]] = unquote(m[2]);
    }
  });
  const bodyStart = text.indexOf("\n", end + 1) + 1;
  return {
    hasFrontmatter: true,
    fields,
    keys,
    body: text.slice(bodyStart),
    bodyLine: text.slice(0, bodyStart).split("\n").length,
  };
}

/** Body lines outside fenced code blocks, with their 1-based line numbers in the file. */
function proseLines(body, bodyLine) {
  const out = [];
  let fenced = false;
  body.split("\n").forEach((line, i) => {
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      return;
    }
    if (!fenced) out.push({ line, n: bodyLine + i });
  });
  return out;
}

function section(body, heading) {
  const lines = body.split("\n");
  let fenced = false;
  const isHeading = lines.map((l) => {
    if (/^\s*```/.test(l)) fenced = !fenced;
    return !fenced && l.startsWith("## ");
  });
  const start = lines.findIndex((l, i) => isHeading[i] && l.trim() === heading);
  if (start === -1) return null;
  const next = isHeading.findIndex((h, i) => h && i > start);
  return lines.slice(start + 1, next === -1 ? undefined : next).join("\n");
}

function finding(id, severity, message, line) {
  return line ? { id, severity, message, line } : { id, severity, message };
}

function checkFrontmatter(parsed, { plugin, skillName, codex }) {
  const out = [];
  const { fields, keys } = parsed;
  const name = fields.name?.value ?? "";
  const description = fields.description?.value ?? "";

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) || name.length > 64 || /anthropic|claude/.test(name)) {
    out.push(
      finding(
        "A01",
        "CRITIQUE",
        `name "${name}" must be ≤ 64 lowercase hyphen-case chars without "anthropic"/"claude"`,
      ),
    );
  } else if (name !== skillName) {
    out.push(finding("A02", "WARNING", `name "${name}" differs from folder "${skillName}"`));
  }
  if (!description || description.length > 1024 || /[<>]/.test(description)) {
    out.push(
      finding(
        "A03",
        "CRITIQUE",
        `description must be non-empty, ≤ 1024 chars, without < or > (${description.length} chars)`,
      ),
    );
  }
  const listed = description.length + (fields.when_to_use?.value.length ?? 0);
  if (listed > 1536)
    out.push(
      finding(
        "A04",
        "WARNING",
        `description + when_to_use is ${listed} chars; Claude Code truncates at 1536`,
      ),
    );

  const context = fields.context?.value;
  if (context !== undefined && context !== "fork")
    out.push(finding("A15", "CRITIQUE", `context "${context}" — only "fork" is valid`));
  for (const key of ["agent", "background"]) {
    if (fields[key] && context !== "fork")
      out.push(finding("A15", "CRITIQUE", `${key} only applies with context: fork`));
  }
  if (fields.effort && !EFFORTS.has(fields.effort.value))
    out.push(finding("A15", "CRITIQUE", `effort "${fields.effort.value}" is invalid`));
  for (const key of BOOLEAN_KEYS) {
    if (fields[key] && !BOOLEAN_WORDS.has(fields[key].value))
      out.push(finding("A15", "CRITIQUE", `${key} must be a boolean`));
  }

  if (codex) {
    if (`${plugin}:${name}`.length > 129)
      out.push(finding("C02", "CRITIQUE", "qualified name exceeds 129 chars"));
    if (!fields.description?.quoted && description.includes(": ")) {
      out.push(
        finding(
          "C03",
          "WARNING",
          'description contains ": " unquoted; strict YAML validators reject it',
        ),
      );
    }
    if (fields["disable-model-invocation"]?.value === "true") {
      out.push(
        finding(
          "C04",
          "CRITIQUE",
          "disable-model-invocation: true fails Codex plugin validation; use agents/openai.yaml policy.allow_implicit_invocation: false",
        ),
      );
    }
    const claudeOnly = keys.filter((k) => CLAUDE_ONLY_KEYS.includes(k));
    if (claudeOnly.length)
      out.push(finding("C05", "INFO", `Codex ignores ${claudeOnly.join(", ")}`));
  }
  return out;
}

function checkBody(parsed, { codex, contract, knownSkills }) {
  const out = [];
  const { body, bodyLine } = parsed;
  const lines = proseLines(body, bodyLine);
  const bodyLines = body.split("\n").length - (body.endsWith("\n") ? 1 : 0);
  if (bodyLines >= 500)
    out.push(finding("A06", "WARNING", `body is ${bodyLines} lines; keep it under 500`));

  if (codex) {
    // The literal reads fine on Codex when the same sentence says it is the user's request.
    const arg = lines.find(
      ({ line }, i) =>
        /\$ARGUMENTS|\$[0-9]\b/.test(line) &&
        !/user|request|prompt/i.test(`${line} ${lines[i + 1]?.line ?? ""}`),
    );
    if (arg)
      out.push(
        finding(
          "C07",
          "WARNING",
          "argument placeholder is not expanded on Codex; phrase it so the literal still reads",
          arg.n,
        ),
      );
    const bang = body.split("\n").findIndex((l) => /(^|\s)!`[^`]+`/.test(l) || /^\s*```!/.test(l));
    if (bang !== -1 && !/run (it|them) manually|unexpanded/i.test(body)) {
      out.push(
        finding(
          "C08",
          "WARNING",
          "dynamic context has no fallback line for Codex, where it is not expanded",
          bodyLine + bang,
        ),
      );
    }
    if (/subagent_type/.test(body) && !/agent-runtime-map/.test(body)) {
      out.push(
        finding(
          "C09",
          "WARNING",
          "raw subagent_type without resolving through shared/agent-runtime-map.md",
        ),
      );
    }
  }

  if (contract) {
    for (const heading of ["## Voice", "## Workflow", "## Final Report"]) {
      if (section(body, heading) !== null)
        out.push(finding("N13", "CRITIQUE", `contract carries ${heading}`));
    }
  } else {
    const voice = section(body, "## Voice");
    if (voice === null || !voice.includes("../../persona.md")) {
      out.push(finding("N01", "CRITIQUE", "no ## Voice section pointing to ../../persona.md"));
    } else if (!/final report|hand-?off|scope/i.test(voice)) {
      out.push(
        finding(
          "N02",
          "WARNING",
          "## Voice does not end the voice's scope at the final report or hand-off",
        ),
      );
    }
  }

  const pile = lines.find(({ line }) => (line.match(PICTOGRAPH) ?? []).length > 1);
  if (pile) out.push(finding("N05", "WARNING", "more than one emoji on a line", pile.n));
  // Quoted user phrasings are trigger examples; an italic _"…"_ line is a hard-coded voice string.
  const foreign = lines.filter(({ line }) =>
    NON_ENGLISH.test(line.replace(/`[^`]*`/g, "").replace(/(?<!_)"[^"]*"(?!_)/g, "")),
  );
  if (foreign.length)
    out.push(
      finding("N06", "WARNING", `${foreign.length} line(s) with non-English text`, foreign[0].n),
    );

  for (const m of body.matchAll(/REQUIRED SUB-SKILL:\*\*\s*Use\s*`([^`]+)`/g)) {
    if (!knownSkills.has(m[1]))
      out.push(finding("N07", "CRITIQUE", `chains to unknown skill ${m[1]}`));
  }
  return out;
}

function checkFiles(parsed, { files, readFile, pluginFileExists, plugin, skillName }) {
  const out = [];
  const allowed = (f) =>
    f === "SKILL.md" || f === "agents/openai.yaml" || /^(scripts|references|assets)\//.test(f);
  for (const f of files.filter((f) => !allowed(f)))
    out.push(finding("C10", "WARNING", `stray file ${f} in the skill folder`));

  const linked = new Set(
    [
      ...parsed.body.matchAll(
        /(?:^|[\s`(])(?:\.\/)?((?:references|scripts|assets)\/[\w./-]+[\w])/gm,
      ),
    ].map((m) => m[1]),
  );
  for (const link of linked) {
    if (!files.includes(link) && !pluginFileExists(link)) {
      out.push(
        finding(
          "A09",
          "WARNING",
          `links ${link}, which exists neither in the skill nor the plugin`,
        ),
      );
    }
  }
  for (const f of files.filter((f) => /^(scripts|references)\//.test(f))) {
    if (!linked.has(f)) out.push(finding("A09", "WARNING", `${f} is never linked from SKILL.md`));
    if (f.endsWith(".md")) {
      const lines = readFile(f).split("\n");
      if (
        lines.length > 100 &&
        !lines.slice(0, 20).some((l) => /^#+\s*(table of )?contents/i.test(l))
      ) {
        out.push(
          finding("A10", "INFO", `${f} is ${lines.length} lines without a table of contents`),
        );
      }
    }
  }

  if (files.includes("agents/openai.yaml")) {
    const yaml = readFile("agents/openai.yaml");
    const get = (key) => unquote(yaml.match(new RegExp(`^\\s*${key}:(.*)$`, "m"))?.[1] ?? "").value;
    const shortDescription = get("short_description");
    if (!get("display_name"))
      out.push(finding("C11", "WARNING", "openai.yaml display_name is empty"));
    if (shortDescription.length < 25 || shortDescription.length > 64) {
      out.push(
        finding(
          "C11",
          "WARNING",
          `openai.yaml short_description is ${shortDescription.length} chars; use 25–64`,
        ),
      );
    }
    const prompt = get("default_prompt");
    if (
      prompt &&
      !prompt.includes(`$${plugin}:${skillName}`) &&
      !prompt.includes(`$${skillName}`)
    ) {
      out.push(finding("C11", "WARNING", "openai.yaml default_prompt does not mention the skill"));
    }
    const implicit = get("allow_implicit_invocation");
    if (implicit && implicit !== "true" && implicit !== "false") {
      out.push(
        finding("C11", "WARNING", "openai.yaml allow_implicit_invocation must be a boolean"),
      );
    }
  }
  return out;
}

/** Every mechanical finding for one SKILL.md. */
export function checkSkill({
  plugin,
  skillName,
  text,
  codex,
  files,
  readFile,
  knownSkills,
  pluginFileExists = () => false,
}) {
  const parsed = parseSkill(text);
  if (!parsed.hasFrontmatter)
    return [finding("C01", "CRITIQUE", "no --- frontmatter; Codex does not load the skill")];
  const contract = parsed.fields.genre?.value === "contract";
  const out = [
    ...checkFrontmatter(parsed, { plugin, skillName, codex }),
    ...checkBody(parsed, { codex, contract, knownSkills }),
    ...checkFiles(parsed, { files, readFile, pluginFileExists, plugin, skillName }),
  ];
  const description = parsed.fields.description?.value ?? "";
  if (contract && description.length > CONTRACT_DESCRIPTION_MAX) {
    out.push(
      finding(
        "N14",
        "WARNING",
        `contract description is ${description.length} chars; a hook may inject it`,
      ),
    );
  }
  return out;
}

/** C12: the Codex listing budget is shared by every installed skill. */
export function checkBudget(skills) {
  const total = skills.filter((s) => s.codex).reduce((sum, s) => sum + s.description.length, 0);
  return total > CODEX_LISTING_BUDGET
    ? [
        finding(
          "C12",
          "WARNING",
          `Codex descriptions total ${total} chars; the listing budget is ${CODEX_LISTING_BUDGET} when the window is unknown`,
        ),
      ]
    : [];
}

function listFiles(dir, prefix = "") {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries
    .filter((e) => !e.name.startsWith("."))
    .flatMap((e) => {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      return e.isDirectory() ? listFiles(path.join(dir, e.name), rel) : [rel];
    });
}

function codexPlugins(root) {
  try {
    const registry = JSON.parse(
      fs.readFileSync(path.join(root, ".agents/plugins/marketplace.json"), "utf8"),
    );
    return new Set(registry.plugins.map((p) => p.name));
  } catch {
    return new Set();
  }
}

/** Review every plugin skill under root. */
export function reviewRepo(root) {
  const codex = codexPlugins(root);
  const entries = [];
  for (const plugin of fs.readdirSync(root).sort()) {
    const skillsDir = path.join(root, plugin, "skills");
    if (
      /^[._]/.test(plugin) ||
      !fs.existsSync(path.join(root, plugin, ".claude-plugin")) ||
      !fs.existsSync(skillsDir)
    )
      continue;
    for (const skillName of fs.readdirSync(skillsDir).sort()) {
      const dir = path.join(skillsDir, skillName);
      if (fs.existsSync(path.join(dir, "SKILL.md"))) entries.push({ plugin, skillName, dir });
    }
  }
  const knownSkills = new Set(entries.map((e) => `${e.plugin}:${e.skillName}`));
  const skills = entries.map(({ plugin, skillName, dir }) => {
    const text = fs.readFileSync(path.join(dir, "SKILL.md"), "utf8");
    return {
      plugin,
      skill: skillName,
      path: path.relative(root, path.join(dir, "SKILL.md")),
      codex: codex.has(plugin),
      description: parseSkill(text).fields.description?.value ?? "",
      findings: checkSkill({
        plugin,
        skillName,
        text,
        codex: codex.has(plugin),
        files: listFiles(dir),
        readFile: (f) => fs.readFileSync(path.join(dir, f), "utf8"),
        pluginFileExists: (f) => fs.existsSync(path.join(root, plugin, f)),
        knownSkills,
      }),
    };
  });
  return { skills, global: checkBudget(skills) };
}

function printReport({ skills, global }) {
  const icon = { CRITIQUE: "❌", WARNING: "⚠️ ", INFO: "·" };
  const count = { CRITIQUE: 0, WARNING: 0, INFO: 0 };
  for (const s of skills) {
    const shown = s.findings;
    console.log(`${shown.some((f) => f.severity !== "INFO") ? "✗" : "✓"} ${s.plugin}:${s.skill}`);
    for (const f of shown) {
      count[f.severity]++;
      console.log(
        `    ${icon[f.severity]} ${f.id} ${f.message}${f.line ? ` (${s.path}:${f.line})` : ""}`,
      );
    }
  }
  for (const f of global) {
    count[f.severity]++;
    console.log(`${icon[f.severity]} ${f.id} ${f.message}`);
  }
  console.log(
    `\n${count.CRITIQUE} critiques · ${count.WARNING} warnings · ${count.INFO} info · ${skills.length} skills`,
  );
  return count.CRITIQUE;
}

const invoked = process.argv[1] && pathToFileURL(fs.realpathSync(process.argv[1])).href;
if (import.meta.url === invoked) {
  const args = process.argv.slice(2);
  const root = path.resolve(args.find((a) => !a.startsWith("--")) ?? process.cwd());
  const report = reviewRepo(root);
  if (args.includes("--json")) console.log(JSON.stringify(report, null, 2));
  else process.exitCode = printReport(report) ? 1 : 0;
}
