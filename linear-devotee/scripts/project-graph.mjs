#!/usr/bin/env node

import fs from "node:fs";

import {
  ProjectGraphError,
  compareProjectGraphs,
  hashMutationEnvelope,
  hashProjectGraph,
  validateMutationEnvelope,
  validateProjectGraph,
} from "../lib/project-graph.mjs";

function readJson(path) {
  const source = path && path !== "-" ? fs.readFileSync(path, "utf8") : fs.readFileSync(0, "utf8");
  return JSON.parse(source);
}

function write(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function usage() {
  return "usage: project-graph.mjs <validate|hash|validate-envelope|hash-envelope|compare> [approved.json] [actual.json]";
}

try {
  const [operation, firstPath, secondPath] = process.argv.slice(2);
  if (operation === "validate" || operation === "hash") {
    const graph = validateProjectGraph(readJson(firstPath));
    const graphHash = hashProjectGraph(graph);
    write({ ok: true, graphHash, payloadHash: graphHash, graph });
  } else if (operation === "validate-envelope" || operation === "hash-envelope") {
    const envelope = validateMutationEnvelope(readJson(firstPath));
    write({
      ok: true,
      payloadHash: hashMutationEnvelope(envelope),
      graphHash: hashProjectGraph(envelope.graph),
      graph: envelope.graph,
      envelope,
    });
  } else if (operation === "compare") {
    let approved;
    let actual;
    if (firstPath && secondPath) {
      approved = readJson(firstPath);
      actual = readJson(secondPath);
    } else {
      const payload = readJson(firstPath);
      approved = payload.approved;
      actual = payload.actual;
    }
    const comparison = compareProjectGraphs(approved, actual);
    write({ ok: comparison.equivalent, ...comparison });
    if (!comparison.equivalent) process.exitCode = 2;
  } else {
    throw new ProjectGraphError("USAGE", usage());
  }
} catch (error) {
  const normalized =
    error instanceof ProjectGraphError
      ? error.toJSON()
      : { code: "INVALID_JSON", message: error instanceof Error ? error.message : String(error) };
  write({ ok: false, error: normalized });
  process.exitCode = 1;
}
