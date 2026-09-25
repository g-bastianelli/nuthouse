// Mechanical Agent Skill checks. Semantic quality stays in the review skill.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const IGNORED_DIRECTORIES = new Set([".git", "node_modules"]);
const MAX_SKILL_LINES = 500;
const LONG_REFERENCE_LINES = 100;

function walk(root, relative = "") {
  const directory = path.join(root, relative);
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) return [];
    const child = path.join(relative, entry.name);
    return entry.isDirectory() ? walk(root, child) : [child];
  });
}

function lineCount(content) {
  return content === "" ? 0 : content.replace(/\n$/, "").split("\n").length;
}

function markdownLinks(content) {
  return [...content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1]);
}

function inlineCodeReferences(content) {
  return [...content.matchAll(/`(references\/[A-Za-z0-9._/-]+\.md(?:#[A-Za-z0-9._-]+)?)`/g)].map(
    (match) => match[1],
  );
}

function directReferenceTargets(content) {
  return [...new Set([...markdownLinks(content), ...inlineCodeReferences(content)])];
}

function supportingReferences(skillFile, allFiles) {
  const referenceRoot = path.join(path.dirname(skillFile), "references") + path.sep;
  return allFiles.filter((file) => file.startsWith(referenceRoot) && file.endsWith(".md"));
}

export function checkSkillStructure(repoRoot) {
  const files = walk(repoRoot);
  const skills = files.filter(
    (file) =>
      !file.startsWith(`_templates${path.sep}`) && path.basename(file).toLowerCase() === "skill.md",
  );
  const problems = [];

  for (const skill of skills) {
    const content = fs.readFileSync(path.join(repoRoot, skill), "utf8");
    const lines = lineCount(content);
    if (lines > MAX_SKILL_LINES) {
      problems.push(
        `${skill}: ${lines} lines exceeds the ${MAX_SKILL_LINES}-line entrypoint limit`,
      );
    }

    for (const target of directReferenceTargets(content)) {
      if (!target.startsWith("references/") || target.includes("<")) continue;
      const cleanTarget = target.split("#", 1)[0];
      if (!fs.existsSync(path.join(repoRoot, path.dirname(skill), cleanTarget))) {
        problems.push(`${skill}: broken supporting-reference link ${target}`);
      }
    }

    for (const reference of supportingReferences(skill, files)) {
      const relativeReference = path.relative(path.dirname(skill), reference);
      const segments = relativeReference.split(path.sep);
      if (segments.length !== 2) {
        problems.push(`${reference}: keep supporting references one level below SKILL.md`);
      }
      const posixReference = relativeReference.split(path.sep).join("/");
      if (!content.includes(posixReference)) {
        problems.push(`${reference}: not routed directly from ${skill}`);
      }

      const referenceContent = fs.readFileSync(path.join(repoRoot, reference), "utf8");
      if (
        lineCount(referenceContent) > LONG_REFERENCE_LINES &&
        !/^## (?:Contents|Table of contents)$/m.test(referenceContent)
      ) {
        problems.push(
          `${reference}: references over ${LONG_REFERENCE_LINES} lines need a contents section`,
        );
      }
    }
  }

  return [...new Set(problems)].sort();
}

function main() {
  const repoRoot = path.resolve(import.meta.dirname, "..");
  const problems = checkSkillStructure(repoRoot);
  if (problems.length > 0) {
    console.error(`Skill structure check failed:\n- ${problems.join("\n- ")}`);
    process.exitCode = 1;
    return;
  }
  console.log("Skill structure check passed.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
