import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const instructions = `# Fixture project

Node.js ESM, no dependencies. Keep established return shapes. Tests use node:test.
Production changes are outside this specification exercise.
`;

const source = `export function invite(actor, input) {
  if (actor.role !== "admin") return { status: 403, error: "forbidden" };
  if (!input.email?.includes("@")) return { status: 400, error: "invalid_email" };
  return { status: 201, invitation: { email: input.email, note: input.note ?? "" } };
}

export function validateNote(note) {
  return typeof note === "string" && note.length <= 240;
}
`;

function spec({ id, solution, architecture, components, errors, acceptance, testing }) {
  return `---
id: ${id}
status: draft
spec-version: 1
linear-project: _none_
verified-by: _none_
last-reviewed: 2026-09-07
---

# ${id}

## Problem & Why
Workspace admins need to invite colleagues without granting viewers write access.

## Solution
${solution}

## Architecture
${architecture}

## Components
${components}

## Error handling
${errors}

## Acceptance
${acceptance}

## Acceptance history
- None.

## Testing approach
${testing}

## Non-goals
- Bulk invitations, billing changes, and automatic retries.
`;
}

const cases = {
  "audit-contradiction": {
    document: spec({
      id: "invite-access",
      solution:
        "Only admins may create invitations. Viewers must receive 403 and create no invitation.",
      architecture:
        "Extend the existing invite function in src/invitations.mjs. No new dependencies or storage boundary.",
      components: "- src/invitations.mjs [modified]: apply invitation access policy.",
      errors:
        "A malformed email returns 400 with invalid_email. A forbidden viewer returns 403 with forbidden.",
      acceptance:
        "- [AC-001] WHEN an admin submits a valid email, THE SYSTEM SHALL return status 201 and an invitation with that email.\n- [AC-002] WHEN a viewer submits a valid email, THE SYSTEM SHALL return status 201 and create the invitation.\n- [AC-003] WHEN an admin submits an invalid email, THE SYSTEM SHALL return status 400 with invalid_email.",
      testing:
        "Use node:test cases for admin success, viewer response, and invalid email; assert response status and absence of invitation on errors.",
    }),
  },
  "audit-boundary": {
    document: spec({
      id: "invite-audit",
      solution:
        "Record each successful admin invitation in an injected audit sink. Audit availability must not prevent an invitation. Viewers remain forbidden.",
      architecture:
        "Add AuditSinkAdapter, consumed only by invite. It isolates exceptions from the injected external sink and normalizes them to a recorded false result. A second consumer is not planned. The boundary lets invitation tests inject a failing sink without depending on external infrastructure. No dependencies are added.",
      components:
        "- src/invitations.mjs [modified]: retains authorization and invokes AuditSinkAdapter after success.\n- src/audit-sink.mjs [new]: calls the supplied sink once and catches its exception; returns whether recording succeeded.",
      errors:
        "Forbidden viewers return 403 without creating or recording an invitation. Invalid emails return 400. A sink exception produces auditRecorded: false with status 201; no retry.",
      acceptance:
        "- [AC-001] WHEN an admin submits a valid email and the sink succeeds, THE SYSTEM SHALL return status 201 with auditRecorded: true and record the invitation email once.\n- [AC-002] WHEN the sink throws during a valid admin invitation, THE SYSTEM SHALL return status 201 with auditRecorded: false and attempt the sink once.\n- [AC-003] WHEN a viewer submits an invitation, THE SYSTEM SHALL return status 403 without calling the sink.\n- [AC-004] WHEN an admin submits an invalid email, THE SYSTEM SHALL return status 400 without calling the sink.",
      testing:
        "Use node:test with injected successful and throwing sinks. Assert returned data, call count, and no sink calls for forbidden or invalid input.",
    }),
  },
  "write-existing": {
    request:
      "Prépare avec write-spec une spec pour valider la note optionnelle des invitations. Les admins peuvent envoyer une note de 0 à 240 caractères ; une note absente devient une chaîne vide, une note non textuelle ou trop longue renvoie 400 avec invalid_note. Les droits existants et les autres réponses restent identiques. Appuie-toi sur le code et ses conventions. Tu peux choisir les détails techniques réversibles. Écris le brouillon et fais-le auditer ; je relirai le document complet avant sa ratification. Aucun commit ni publication.",
  },
  "plan-existing": {
    skill: "write-plan",
    document: spec({
      id: "invite-note",
      solution:
        "Validate an optional invitation note after existing authorization and email validation. An absent note becomes an empty string. An explicitly supplied note must be a string whose JavaScript length is at most 240. Invalid notes return 400 with invalid_note and no invitation. Existing authorization, email errors, and success fields remain unchanged.",
      architecture:
        "Reuse validateNote from src/invitations.mjs inside invite after the email guard. Preserve the current priority: forbidden actor, invalid email, invalid note, then success. No new dependency or external boundary.",
      components:
        "- src/invitations.mjs [modified]: normalize an absent note, validate it with validateNote, return the established response shape.\n- tests/invitations.test.mjs [new]: node:test coverage of externally visible results.",
      errors:
        "A non-admin returns 403/forbidden regardless of input. An admin's invalid email returns 400/invalid_email before note validation. A supplied null, number, object, or string longer than 240 returns 400/invalid_note without an invitation after other guards pass.",
      acceptance:
        "- [AC-001] WHEN an admin submits a valid email with an absent note, THE SYSTEM SHALL return 201 with the email and an empty note.\n- [AC-002] WHEN an admin submits a valid email and a string note with JavaScript length from 0 to 240 inclusive, THE SYSTEM SHALL return 201 and preserve that note verbatim.\n- [AC-003] WHEN an admin submits a valid email and a supplied non-string note or a string longer than 240, THE SYSTEM SHALL return 400 with invalid_note and no invitation.\n- [AC-004] WHEN a non-admin submits any invitation, THE SYSTEM SHALL return 403 with forbidden and no invitation.\n- [AC-005] WHEN an admin submits an invalid email, THE SYSTEM SHALL return 400 with invalid_email and no invitation regardless of the note.",
      testing:
        "Use node:test to call invite and assert the complete return shapes for missing/empty/240/241-length notes, null, number, object, forbidden actors, and invalid email precedence. Test the observable invite result, not just validateNote in isolation.",
    })
      .replace("status: draft", "status: ratified")
      .replace("verified-by: _none_", "verified-by: spec-auditor"),
    request:
      "Cette spec est approuvée. Prépare et valide le plan complet avec write-plan. Je te délègue les détails techniques réversibles dans ce périmètre. Aucun code de production à modifier, aucun commit ni publication ; termine par les chemins des artefacts et le résultat de la revue.",
  },
};

export function prepareEvaluation(pluginRoot, caseName) {
  const scenario = cases[caseName];
  if (!scenario)
    throw new Error(`Unknown case: ${caseName}. Choose ${Object.keys(cases).join(", ")}`);
  const directory = mkdtempSync(join(tmpdir(), "acid-prophet-eval-"));
  const project = join(directory, "project");
  const plugin = join(directory, "plugin");
  mkdirSync(join(project, "src"), { recursive: true });
  cpSync(pluginRoot, plugin, {
    recursive: true,
    filter: (entry) => !["assets", "evals"].includes(entry.split(/[\\/]/).at(-1)),
  });
  writeFileSync(join(project, "AGENTS.md"), instructions);
  writeFileSync(
    join(project, "package.json"),
    JSON.stringify({ type: "module", scripts: { test: "node --test" } }, null, 2) + "\n",
  );
  writeFileSync(join(project, "src/invitations.mjs"), source);
  execFileSync("git", ["init", "--quiet", project]);
  let request = scenario.request;
  if (scenario.document) {
    const specPath = join(project, "docs/acid-prophet/specs/2026-09-07-invitations.md");
    mkdirSync(join(project, "docs/acid-prophet/specs"), { recursive: true });
    writeFileSync(specPath, scenario.document);
    request = scenario.skill
      ? `Use ${join(plugin, `skills/${scenario.skill}/SKILL.md`)} in ${project}.\nSPEC_FILE: ${specPath}\n${scenario.request}`
      : `Read and follow ${join(plugin, "agents/spec-auditor.md")} to audit this spec.\nSPEC_PATH: ${specPath}\nPROJECT_ROOT: ${project}\nPLUGIN_ROOT: ${plugin}\nMODE: report-only\nReturn the complete structured auditor report.`;
  } else {
    request = `Use the skill at ${join(plugin, "skills/write-spec/SKILL.md")} for this request, in ${project}.\n${request}`;
  }
  const prompt = `${request}\n\nEvaluation environment: PLUGIN_ROOT = ${plugin}. Resolve plugin references within that snapshot, including when tools expose an older installed agent; a generic fresh agent may follow the snapshot's auditor instructions. Only the fixture project is writable. Do not read evaluation rubrics or the source workspace. Do not use network services, commit, or publish. Stop at the next necessary user decision without simulating a user reply. Prefix shell commands with rtk.\n`;
  writeFileSync(join(directory, "prompt.txt"), prompt);
  return { caseName, directory, project, plugin, promptPath: join(directory, "prompt.txt") };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(
    JSON.stringify(
      prepareEvaluation(
        resolve(process.argv[2] ?? join(import.meta.dirname, "..")),
        process.argv[3],
      ),
      null,
      2,
    ),
  );
}
