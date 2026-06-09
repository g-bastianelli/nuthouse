#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SEVERITIES = ["BLOCKER", "HIGH", "MEDIUM", "LOW", "NIT", "INFO"];
const SEVERITY_PATTERN = new RegExp(`^(${SEVERITIES.join("|")}):\\s+.+`, "m");

export function extractFindingBlocks(markdown) {
  const lines = markdown.split("\n");
  const blocks = [];
  let current = null;

  for (const line of lines) {
    if (SEVERITY_PATTERN.test(line)) {
      if (current) blocks.push(current);
      current = [line];
      continue;
    }
    if (current) current.push(line);
  }

  if (current) blocks.push(current);
  return blocks.map((block) => block.join("\n").trim());
}

function hasNoFindingSignal(markdown) {
  return /no (blocking )?findings/i.test(markdown) || /no issues found/i.test(markdown);
}

export function validateFindings(markdown) {
  const blocks = extractFindingBlocks(markdown);
  const errors = [];

  if (blocks.length === 0) {
    if (!hasNoFindingSignal(markdown)) {
      errors.push("No finding blocks and no explicit no-findings signal.");
    }
    return { valid: errors.length === 0, errors, findings: 0 };
  }

  blocks.forEach((block, index) => {
    const label = `finding ${index + 1}`;
    if (!/^((BLOCKER|HIGH|MEDIUM|LOW|NIT|INFO):\s+.+)/m.test(block)) {
      errors.push(`${label}: missing severity title.`);
    }
    if (!/File:\s+.+:\d+/m.test(block) && !/Files?:\s+.+/m.test(block)) {
      errors.push(`${label}: missing File with line number, or Files for cross-file findings.`);
    }
    if (!/Evidence:\s+.+/ms.test(block)) errors.push(`${label}: missing Evidence.`);
    if (!/Impact:\s+.+/ms.test(block)) errors.push(`${label}: missing Impact.`);
    if (!/Fix:\s+.+/ms.test(block)) errors.push(`${label}: missing Fix.`);
  });

  return { valid: errors.length === 0, errors, findings: blocks.length };
}

function readStdin() {
  return readFileSync(0, "utf8");
}

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const file = args.find((arg) => !arg.startsWith("--"));
  const markdown = file ? readFileSync(file, "utf8") : readStdin();
  const result = validateFindings(markdown);

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.valid) {
    console.log(`valid: ${result.findings} finding(s)`);
  } else {
    console.log(`invalid: ${result.errors.length} error(s)`);
    for (const error of result.errors) console.log(`- ${error}`);
  }

  if (!result.valid) process.exit(1);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  main();
}
