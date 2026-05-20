const SECTION_HEADERS = {
  gates: /^##\s+Gates\s*$/,
  blockers: /^##\s+BLOCKER\s*\(/,
  warnings: /^##\s+WARNING\s*\(/,
  infos: /^##\s+INFO\s*\(/,
  autoFixes: /^##\s+Auto-fix candidates\s*$/,
  summary: /^##\s+Summary\s*$/,
};

const SUMMARY_RE = /(\d+)\s+blocker\s*·\s*(\d+)\s+warning\s*·\s*(\d+)\s+info/i;
const BULLET_RE = /^-\s+(.+)$/;
const GATE_RE = /^([a-z][a-z0-9-]*)\s*:\s*(pass|fail|n\/a|yes|no)\s*$/i;

const KNOWN_GATES = new Set([
  "simplicity",
  "anti-abstraction",
  "acceptance-defined",
  "clarifications-resolved",
  "constitution",
]);

export function parseSpecAuditorReport(raw) {
  if (typeof raw !== "string" || raw.length === 0) return null;

  const lines = raw.split("\n");
  const buckets = {
    blockers: [],
    warnings: [],
    infos: [],
    autoFixes: [],
  };
  const gates = {};
  let handoffEligible = null;
  let sawGatesSection = false;
  let summary = null;
  let currentBucket = null;
  let inGates = false;
  let inSummary = false;

  for (const line of lines) {
    if (SECTION_HEADERS.gates.test(line)) {
      inGates = true;
      sawGatesSection = true;
      currentBucket = null;
      inSummary = false;
      continue;
    }
    if (SECTION_HEADERS.blockers.test(line)) {
      currentBucket = "blockers";
      inGates = false;
      inSummary = false;
      continue;
    }
    if (SECTION_HEADERS.warnings.test(line)) {
      currentBucket = "warnings";
      inGates = false;
      inSummary = false;
      continue;
    }
    if (SECTION_HEADERS.infos.test(line)) {
      currentBucket = "infos";
      inGates = false;
      inSummary = false;
      continue;
    }
    if (SECTION_HEADERS.autoFixes.test(line)) {
      currentBucket = "autoFixes";
      inGates = false;
      inSummary = false;
      continue;
    }
    if (SECTION_HEADERS.summary.test(line)) {
      currentBucket = null;
      inGates = false;
      inSummary = true;
      continue;
    }

    if (inGates) {
      const bulletMatch = line.match(BULLET_RE);
      if (!bulletMatch) continue;
      const gateMatch = bulletMatch[1].match(GATE_RE);
      if (!gateMatch) continue;
      const name = gateMatch[1].toLowerCase();
      const value = gateMatch[2].toLowerCase();
      if (name === "handoff-eligible") {
        handoffEligible = value === "yes";
      } else {
        gates[name] = value;
      }
      continue;
    }

    if (inSummary) {
      const m = line.match(SUMMARY_RE);
      if (m) {
        summary = {
          blocker: Number(m[1]),
          warning: Number(m[2]),
          info: Number(m[3]),
        };
        inSummary = false;
      }
      continue;
    }

    if (currentBucket) {
      const bulletMatch = line.match(BULLET_RE);
      if (!bulletMatch) continue;
      const text = bulletMatch[1].trim();
      const isFindingBucket = currentBucket !== "autoFixes";
      if (isFindingBucket && !text.startsWith("[")) continue;
      buckets[currentBucket].push(text);
    }
  }

  if (!summary) return null;

  // Fallback: derive handoff-eligible if the auditor omitted it (older specs).
  if (handoffEligible === null) {
    if (!sawGatesSection) {
      handoffEligible = summary.blocker === 0;
    } else {
      const anyFail = Object.values(gates).some((v) => v === "fail");
      handoffEligible = !anyFail && summary.blocker === 0;
    }
  }

  return {
    ...buckets,
    gates: sawGatesSection ? gates : null,
    handoffEligible,
    summary,
  };
}

export { KNOWN_GATES };
