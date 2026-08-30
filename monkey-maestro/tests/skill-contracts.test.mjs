import { expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateLinearSnapshot } from "../lib/linear-snapshot.mjs";
import { validateControlSnapshot } from "../lib/records.mjs";
import { validateRuntimeSnapshot } from "../lib/runtime-snapshot.mjs";
import { checkWorkflowMigration } from "../../scripts/check-workflow-migration.mjs";

const ROOT = path.resolve(import.meta.dir, "..", "..");
const SKILL_NAMES = ["orchestrate", "reconcile", "spawn", "start", "status", "stop"];
const AGENT_NAMES = ["control-loader", "project-snapshot-loader", "runtime-inspector"];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function normalize(document) {
  return document
    .replace(/[`*#|]/g, " ")
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\s+([,;:.!?])/g, "$1")
    .trim()
    .toLowerCase();
}

function frontmatter(document) {
  const match = document.match(/^---\n([\s\S]*?)\n---/);
  expect(match).not.toBeNull();
  return match[1];
}

function frontmatterField(document, field) {
  const match = frontmatter(document).match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
  expect(match, `missing frontmatter field: ${field}`).not.toBeNull();
  return match[1].trim();
}

function allowedTools(document) {
  return frontmatterField(document, "allowed-tools");
}

function agentTools(document) {
  const match = frontmatter(document).match(/(?:^|\n)tools:\n([\s\S]*?)(?=\n\S|$)/);
  expect(match).not.toBeNull();
  return [...match[1].matchAll(/^\s*-\s*(.+)$/gm)].map((entry) => entry[1]);
}

function skill(name) {
  return read(`monkey-maestro/skills/${name}/SKILL.md`);
}

function agent(name) {
  return read(`monkey-maestro/agents/${name}.md`);
}

const skills = Object.fromEntries(SKILL_NAMES.map((name) => [name, skill(name)]));
const agents = Object.fromEntries(AGENT_NAMES.map((name) => [name, agent(name)]));

test("the public surface is exactly six Linear-first skills and three canonical agents", () => {
  const skillDirectories = fs
    .readdirSync(path.join(ROOT, "monkey-maestro/skills"), { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        fs.existsSync(path.join(ROOT, "monkey-maestro/skills", entry.name, "SKILL.md")),
    )
    .map((entry) => entry.name)
    .sort();
  const agentFiles = fs
    .readdirSync(path.join(ROOT, "monkey-maestro/agents"), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name.replace(/\.md$/, ""))
    .sort();

  expect(skillDirectories).toEqual(SKILL_NAMES);
  expect(agentFiles).toEqual(AGENT_NAMES);

  for (const name of SKILL_NAMES) {
    expect(frontmatterField(skills[name], "name")).toBe(name);
    expect(skills[name]).toContain("project-execution-contract.md");
  }
  for (const name of AGENT_NAMES) expect(frontmatterField(agents[name], "name")).toBe(name);
});

test("legacy scheduler state and GitHub capabilities are forbidden across the public surface", () => {
  const publicSkills = Object.values(skills);
  const allDocuments = [...publicSkills, ...Object.values(agents)];

  for (const document of publicSkills) {
    for (const forbidden of [
      "reconcile_required",
      "decisionBaseline",
      "decisionHash",
      "graphHash",
      "EXPECTED_DECISION_HASH",
      "confirmedRunnableExpansions",
      "executionIssueIds",
      "exitedExecutionIssueIds",
      "scripts/reconcile-state.mjs",
      "nuthouse:project-graph-receipt",
    ]) {
      expect(document, `public skill revived legacy authority: ${forbidden}`).not.toContain(
        forbidden,
      );
    }
    expect(allowedTools(document)).not.toMatch(/bash\(gh(?::|\))/i);
    expect(allowedTools(document)).not.toMatch(/github/i);
  }

  for (const document of allDocuments) expect(document).not.toContain("reconcile_required");
  for (const document of Object.values(agents)) {
    expect(agentTools(document).join(" ")).not.toMatch(/github|\bgh\b/i);
  }
});

test("the migration gate rejects removal of every Maestro public entry point", () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "maestro-required-paths-"));
  const requiredPaths = [
    ...SKILL_NAMES.map((name) => `monkey-maestro/skills/${name}/SKILL.md`),
    ...AGENT_NAMES.map((name) => `monkey-maestro/agents/${name}.md`),
    "monkey-maestro/lib/orchestration-effect-signal.mjs",
    "monkey-maestro/lib/orchestration-effects.mjs",
    "monkey-maestro/scripts/linear-frontier.mjs",
    "monkey-maestro/scripts/linear-snapshot.mjs",
    "monkey-maestro/scripts/orchestration-epoch.mjs",
    "monkey-maestro/scripts/project-lock.mjs",
    "monkey-maestro/scripts/records.mjs",
    "monkey-maestro/scripts/runtime-actions.mjs",
    "monkey-maestro/scripts/runtime-snapshot.mjs",
  ];

  try {
    const problems = checkWorkflowMigration(fixture);
    for (const filename of requiredPaths) {
      expect(problems, `migration gate did not require ${filename}`).toContain(
        `missing required ${filename}`,
      );
    }
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test("AC-021/027: start writes only minimal v2 control, verifies it, then orchestrates", () => {
  const start = normalize(skills.start);
  const tools = allowedTools(skills.start);

  expect(start).toMatch(
    /activation configures transport; it does not verify, freeze, hash, or adopt the linear graph/,
  );
  expect(start).toMatch(
    /build a schema-v2 successor.*contains only the fields in the shared contract/,
  );
  expect(start).toMatch(
    /leave an active control unchanged.*only when.*sourceschemaversion is 2.*no explicit transport, agent, or concurrency override/,
  );
  expect(start).toMatch(
    /active source-v1 control requires migration, and any explicit override requests a control update.*continue through the preview and verified v2 write/,
  );
  expect(start).toMatch(
    /fresh runid, active: true, revision one above the latest usable control or 1/,
  );
  expect(start).toMatch(/show the complete mutation preview and ask once/);
  expect(start).toMatch(/on y, save one linear project comment/);
  expect(start).toMatch(
    /re-dispatch control-loader.*require the exact written project\/run\/config\/revision/,
  );
  expect(start).toMatch(/enter monkey-maestro:orchestrate <project-id>/);
  expect(tools).not.toMatch(/superset|github|bash\(gh/i);
  expect(start).toMatch(
    /do not call github, superset, the project snapshot loader, or the project lock before writing control/,
  );
});

test("AC-022: status derives a read-only report from live Linear without runtime inspection", () => {
  const status = normalize(skills.status);
  const tools = allowedTools(skills.status);

  expect(status).toMatch(/strictly read-only and linear-only/);
  expect(status).toMatch(/project-snapshot-loader with mode: full/);
  expect(status).toMatch(
    /scripts\/linear-snapshot\.mjs: hydrate the exact expected project\/full snapshot.*run planlinearfrontier through scripts\/linear-frontier\.mjs/,
  );
  expect(status).toMatch(/scoped unknown stays on its row/);
  expect(status).toMatch(/runtime: not inspected/);
  expect(status).toMatch(
    /never recommend reconcile for a link change, stale history, runtime residue/,
  );
  expect(tools).not.toMatch(/superset|save_comment|github|bash\(gh/i);
});

test("AC-023/027: stop is a verified Linear-only active:false v2 revision", () => {
  const stop = normalize(skills.stop);
  const tools = allowedTools(skills.stop);

  expect(stop).toMatch(/stop is linear-only/);
  expect(stop).toMatch(
    /build a schema-v2 successor containing only the projected operational fields, with active: false, revision \+ 1/,
  );
  expect(stop).toMatch(/on y, save one linear project comment/);
  expect(stop).toMatch(/require the exact successor with active: false/);
  expect(stop).toMatch(/existing workspaces and agents keep running/);
  expect(tools).not.toMatch(/superset|github|bash\(gh/i);
});

test("AC-024: reconcile uses candidate scope and repairs telemetry only", () => {
  const reconcile = normalize(skills.reconcile);
  const tools = allowedTools(skills.reconcile);

  expect(reconcile).toMatch(/optional runtime forensic\/repair tool/);
  expect(reconcile).toMatch(
    /cannot make an issue ready or blocked, adopt a relation.*dispatch a worker/,
  );
  expect(reconcile).toMatch(
    /mode: targeted and those exact ids when the user supplied a scope, otherwise mode: full to discover started issues/,
  );
  expect(reconcile).toMatch(
    /exact validated non-terminal frontier rows explicitly supplied by the user; otherwise.*every non-terminal started issue/,
  );
  expect(reconcile).toMatch(
    /split terminal issues out before runtime inspection.*report-only rows.*never enter the superset audit or repair scope/,
  );
  expect(reconcile).toMatch(/runtime-inspector for the exact scope/);
  expect(reconcile).toMatch(
    /scripts\/runtime-snapshot\.mjs validate-audit.*exact selected non-terminal frontier rows and expected host\/superset\/linear context/,
  );
  expect(reconcile).toMatch(
    /permits opaque ready, started, blocked, and unknown classifications but rejects terminal rows, normalized matches, context mismatch, and expanded or incomplete scope/,
  );
  expect(reconcile).toMatch(/never call planruntimeactions or alter a linear classification/);
  expect(reconcile).toMatch(
    /before deciding that telemetry is missing or stale, read every page of comments for each exact-runtime issue/,
  );
  expect(reconcile).toMatch(
    /parse only the canonical issue-scoped execution-record marker.*unavailable page makes that issue non-repairable/,
  );
  expect(reconcile).toMatch(
    /complete pre-write comment set as the idempotence boundary.*already-equivalent accepted record.*never duplicated/,
  );
  expect(reconcile).toMatch(
    /missing or stale best-effort execution record may be repaired after one grouped preview and explicit confirmation.*re-fetch every page of the exact issue comments and verify every accepted repair/,
  );
  expect(reconcile).toMatch(
    /write only issue-scoped telemetry comments; never rewrite control, graph, links, statuses, or runtime resources/,
  );
  expect(reconcile).toMatch(/a failed reconciliation never prevents later orchestrate/);
  expect(tools).toContain("mcp__claude_ai_Linear__list_comments");
  expect(tools).toMatch(/Bash\(superset workspaces get:\*\)/i);
  expect(tools).not.toMatch(/workspaces create|agents create|workspaces delete|github|bash\(gh/i);
});

test("AC-027: usable v1 operations migrate without restoring graph or hash authority", () => {
  expect(normalize(skills.status)).toMatch(
    /malformed obsolete v1 field is only a warning when operational fields remain projectable/,
  );
  expect(normalize(skills.orchestrate)).toMatch(/obsolete v1 graph\/hash fields are warnings only/);
  expect(normalize(skills.start)).toMatch(
    /configuration from explicit arguments first, then the latest usable active or inactive control/,
  );
  expect(normalize(skills.stop)).toMatch(
    /schema-v2 successor containing only the projected operational fields/,
  );
});

test("control-loader is raw one-project control evidence, never a scheduler", () => {
  const control = normalize(agents["control-loader"]);

  expect(agentTools(agents["control-loader"])).toEqual([
    "mcp__claude_ai_Linear__get_project",
    "mcp__claude_ai_Linear__list_comments",
  ]);
  expect(control).toMatch(
    /fetch the exact project and require its returned id to equal project_id/,
  );
  expect(control).toMatch(/traverse the project's comment pages to exhaustion exactly once/);
  expect(control).toMatch(/do not stop at the provider's default page size/);
  expect(control).toMatch(/body contains the marker prefix.*nuthouse:maestro-control/);
  expect(control).toMatch(/matches versioned markers such as.*schema_version=2/);
  expect(control).toMatch(/never parse, select, repair, or normalize a control yourself/);
  expect(control).toMatch(/no issue, relation, graph receipt, waiver, execution, or result reads/);
  expect(control).toMatch(/return strict json only/);

  const envelope = {
    schemaVersion: 1,
    provider: "ready",
    project: { id: "project-1", name: "Project One" },
    comments: [
      {
        id: "comment-1",
        body: "<!-- nuthouse:maestro-control schema_version=2 -->\n```json\n{}\n```",
        createdAt: "2026-08-30T10:00:00.000Z",
        updatedAt: "2026-08-30T10:00:00.000Z",
      },
    ],
    unknown: [],
  };
  expect(validateControlSnapshot(envelope, { expectedProjectId: "project-1" })).toEqual(envelope);
  expect(() =>
    validateControlSnapshot(envelope, { expectedProjectId: "different-project" }),
  ).toThrow("expected project different-project, received project-1");
});

test("project-snapshot-loader emits the exact full and targeted validator envelope", () => {
  const snapshot = normalize(agents["project-snapshot-loader"]);

  expect(agentTools(agents["project-snapshot-loader"])).toEqual([
    "mcp__claude_ai_Linear__get_project",
    "mcp__claude_ai_Linear__list_issues",
    "mcp__claude_ai_Linear__get_issue",
  ]);
  expect(snapshot).toMatch(
    /in full mode, traverse list_issues pages for that project to exhaustion exactly once/,
  );
  expect(snapshot).toMatch(/do not stop at the provider's default page size/);
  expect(snapshot).toMatch(/fetch every returned issue with get_issue\(includerelations: true\)/);
  expect(snapshot).toMatch(/in targeted mode, never call list_issues/);
  expect(snapshot).toMatch(/fetch exactly every requested issue_ids entry/);
  expect(snapshot).toMatch(
    /failed issue detail becomes an unknown issue row.*statustype: "unknown".*blockerissueids: \[\].*datastate: "unknown".*scoped unknown entry/,
  );
  expect(snapshot).toMatch(/for full, requestedissueids is always \[\]/);
  expect(snapshot).toMatch(/envelope is passed directly to validatelinearsnapshot/);
  expect(snapshot).toMatch(/retrieval only; never calculate ready, blocked, capacity, or force/);

  const envelope = {
    schemaVersion: 1,
    projectId: "project-1",
    scope: { mode: "full", requestedIssueIds: [] },
    issues: [
      {
        issueId: "TEAM-1",
        projectId: "project-1",
        statusType: "unknown",
        blockerIssueIds: [],
        dataState: "unknown",
      },
    ],
    unknown: [{ issueId: "TEAM-1", code: "ISSUE_UNAVAILABLE", detail: "read failed" }],
  };
  expect(
    validateLinearSnapshot(envelope, {
      expectedProjectId: "project-1",
      expectedScope: { mode: "full", requestedIssueIds: [] },
    }),
  ).toEqual(envelope);
});

test("runtime-inspector stays selected-only and its raw envelope normalizes at the boundary", () => {
  const runtime = normalize(agents["runtime-inspector"]);

  expect(agentTools(agents["runtime-inspector"])).toEqual(["Bash"]);
  expect(runtime).toMatch(/linear selection has already happened/);
  expect(runtime).toMatch(/cannot add, remove, or reclassify a candidate/);
  expect(runtime).toMatch(
    /empty selection returns an empty ready snapshot without any superset command/,
  );
  expect(runtime).toMatch(
    /for each exact selected issue, run superset tasks get <issueid> --json in parallel/,
  );
  expect(runtime).toMatch(
    /for a real project scope, require externalprojectid === linear_project_id/,
  );
  expect(runtime).toMatch(
    /for manual:<issueid>, require the task's external project id to be absent\/null.*suffix to equal issueid/,
  );
  expect(runtime).toMatch(/run exactly one superset workspaces list/);
  expect(runtime).toMatch(
    /exact-get every returned row whose task, host, or project binding field is absent before classifying it/,
  );
  expect(runtime).toMatch(
    /if an incomplete row cannot be hydrated or excluded, mark every selected issue it could represent as a scoped unknown; never filter that row into a false zero-workspace result/,
  );
  expect(runtime).toMatch(
    /group only entries whose (?:hydrated )?task, host, and project ids exactly match the validated task and all three requested context ids/,
  );
  expect(runtime).toMatch(/list terminals only for exact matched workspaces/);
  expect(runtime).toMatch(
    /return every requested identifier either as one issue row or one scoped unknown/,
  );
  expect(runtime).toMatch(/echo all three exact input context ids/);
  expect(runtime).toMatch(
    /preserve the raw binding fields.*do not reduce them to taskid or workspaceids/,
  );
  expect(runtime).toMatch(/no github or gh command/);
  expect(runtime).toMatch(/no workspace\/agent\/terminal mutation/);

  expect(() =>
    validateRuntimeSnapshot(
      {
        schemaVersion: 1,
        context: {
          targetHostId: "host-1",
          supersetProjectId: "superset-project-1",
          linearProjectId: "linear-project-1",
        },
        scope: { selectedIssueIds: [] },
        issues: [],
        unknown: [],
      },
      [],
      {
        expectedContext: {
          targetHostId: "host-1",
          supersetProjectId: "superset-project-1",
          linearProjectId: "linear-project-1",
        },
      },
    ),
  ).toThrow("RUNTIME_PROVIDER_STATE_REQUIRED");

  expect(
    validateRuntimeSnapshot(
      {
        schemaVersion: 1,
        provider: "ready",
        context: {
          targetHostId: "host-1",
          supersetProjectId: "superset-project-1",
          linearProjectId: "linear-project-1",
        },
        scope: { selectedIssueIds: ["TEAM-1"] },
        issues: [
          {
            issueId: "TEAM-1",
            task: {
              id: "task-1",
              externalProvider: "linear",
              externalKey: "TEAM-1",
              externalProjectId: "linear-project-1",
              deletedAt: null,
              syncError: null,
            },
            workspaces: [
              {
                workspaceId: "workspace-1",
                taskId: "task-1",
                hostId: "host-1",
                projectId: "superset-project-1",
              },
            ],
            terminals: [{ workspaceId: "workspace-1", terminalId: "terminal-1", active: true }],
            dataState: "known",
          },
        ],
        unknown: [],
      },
      [{ issueId: "TEAM-1", classification: "ready", forced: false, blockerIssueIds: [] }],
      {
        expectedContext: {
          targetHostId: "host-1",
          supersetProjectId: "superset-project-1",
          linearProjectId: "linear-project-1",
        },
      },
    ),
  ).toEqual({
    schemaVersion: 1,
    context: {
      targetHostId: "host-1",
      supersetProjectId: "superset-project-1",
      linearProjectId: "linear-project-1",
    },
    scope: { mode: "targeted", requestedIssueIds: ["TEAM-1"] },
    matches: [
      {
        issueId: "TEAM-1",
        taskId: "task-1",
        workspaceIds: ["workspace-1"],
        terminalIds: ["terminal-1"],
        activeTerminalIds: ["terminal-1"],
        exitedTerminalIds: [],
        dataState: "known",
      },
    ],
    unknown: [],
  });

  const incompleteBinding = validateRuntimeSnapshot(
    {
      schemaVersion: 1,
      provider: "partial",
      context: {
        targetHostId: "host-1",
        supersetProjectId: "superset-project-1",
        linearProjectId: "linear-project-1",
      },
      scope: { selectedIssueIds: ["TEAM-2"] },
      issues: [],
      unknown: [
        {
          issueId: "TEAM-2",
          code: "WORKSPACE_BINDING_UNAVAILABLE",
          detail: "incomplete workspace row could not be hydrated or excluded",
        },
      ],
    },
    [{ issueId: "TEAM-2", classification: "ready", forced: false, blockerIssueIds: [] }],
    {
      expectedContext: {
        targetHostId: "host-1",
        supersetProjectId: "superset-project-1",
        linearProjectId: "linear-project-1",
      },
    },
  );
  expect(incompleteBinding.matches).toEqual([
    {
      issueId: "TEAM-2",
      workspaceIds: [],
      terminalIds: [],
      activeTerminalIds: [],
      exitedTerminalIds: [],
      dataState: "unknown",
    },
  ]);
});

test("AC-026: every consumer validates agent schema and exact scope before using facts", () => {
  const orchestrate = normalize(skills.orchestrate);
  const spawn = normalize(skills.spawn);
  const reconcile = normalize(skills.reconcile);

  for (const name of ["status", "start", "orchestrate", "reconcile", "stop"]) {
    expect(
      normalize(skills[name]),
      `${name} must bind raw control evidence to its project`,
    ).toMatch(/complete (?:control-loader )?envelope plus exact expectedprojectid/);
  }
  expect(spawn).toMatch(/validate its exact project\/provider\/schema envelope/);

  expect(orchestrate).toMatch(
    /scripts\/linear-snapshot\.mjs hydrate with the exact expected project and full snapshot.*reject invalid output before cache mutation/,
  );
  expect(orchestrate).toMatch(
    /global schema\/scope or project-wide failure retries the same full retrieval once/,
  );
  expect(orchestrate).toMatch(
    /validation identifies malformed issue ids, retry exactly those ids once with mode: targeted.*validated cache with scoped unknowns, retry only those ids and use refresh.*persistent per-issue failure stays unknown only for that component/,
  );
  expect(orchestrate).toMatch(
    /validate its schema, exact project\/host context, and exact scope through scripts\/runtime-actions\.mjs.*retry only those ids once; never expand to a full project scan.*scripts\/runtime-snapshot\.mjs merge-targeted.*only its returned full raw runtimesnapshot enters scripts\/runtime-actions\.mjs.*merge-targeted-unknown/,
  );
  expect(spawn).toMatch(
    /validate the exact project\/host context and scope with scripts\/runtime-actions\.mjs/,
  );
  expect(reconcile).toMatch(
    /validate its strict raw response through scripts\/runtime-snapshot\.mjs validate-audit/,
  );
});
