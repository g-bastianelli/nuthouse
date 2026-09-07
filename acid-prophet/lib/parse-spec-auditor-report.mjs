export const KNOWN_GATES = new Set([
  "simplicity",
  "anti-abstraction",
  "behavior-consistent",
  "acceptance-defined",
  "acceptance-traceable",
  "clarifications-resolved",
  "constitution",
]);

const FINDING_SECTIONS = { BLOCKER: "blockers", WARNING: "warnings", INFO: "infos" };
const SUMMARY_KEYS = { blockers: "blocker", warnings: "warning", infos: "info" };

export function parseSpecAuditorReport(raw) {
  if (typeof raw !== "string" || !raw.trim()) return null;

  const buckets = { blockers: [], warnings: [], infos: [], autoFixes: [] };
  const gates = {};
  const sections = new Set();
  const declaredCounts = {};
  let section = null;
  let summary = null;
  let claimedHandoff = null;

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (!section && /^# spec-auditor report\b/.test(line)) continue;

    if (line.startsWith("##")) {
      const findingHeading = line.match(/^##\s+(BLOCKER|WARNING|INFO)\s*\((\d+)\)$/);
      if (findingHeading) {
        section = FINDING_SECTIONS[findingHeading[1]];
        declaredCounts[section] = Number(findingHeading[2]);
      } else if (/^##\s+Gates$/.test(line)) section = "gates";
      else if (/^##\s+Auto-fix candidates$/.test(line)) section = "autoFixes";
      else if (/^##\s+Summary$/.test(line)) section = "summary";
      else return null;
      if (sections.has(section)) return null;
      sections.add(section);
      continue;
    }

    if (section === "gates") {
      const match = line.match(/^-\s+([a-z][a-z0-9-]*)\s*:\s*(pass|fail|n\/a|yes|no)$/i);
      if (!match) return null;
      const name = match[1].toLowerCase();
      const value = match[2].toLowerCase();
      if (name === "handoff-eligible") {
        if (claimedHandoff !== null || !["yes", "no"].includes(value)) return null;
        claimedHandoff = value === "yes";
      } else {
        if (!KNOWN_GATES.has(name) || Object.hasOwn(gates, name)) return null;
        const allowed = name === "constitution" ? ["pass", "fail", "n/a"] : ["pass", "fail"];
        if (!allowed.includes(value)) return null;
        gates[name] = value;
      }
    } else if (section === "summary") {
      const match = line.match(/^(\d+)\s+blocker\s*·\s*(\d+)\s+warning\s*·\s*(\d+)\s+info$/i);
      if (!match || summary) return null;
      summary = { blocker: Number(match[1]), warning: Number(match[2]), info: Number(match[3]) };
    } else if (section === "autoFixes") {
      if (/^(?:-\s+)?\(no auto-fixes proposed\)$/.test(line)) continue;
      const match = line.match(/^-\s+(.+)$/);
      if (!match) return null;
      buckets.autoFixes.push(match[1]);
    } else if (Object.hasOwn(SUMMARY_KEYS, section)) {
      const match = line.match(/^-\s+(\[[^\]]+\]\s+\S.*)$/);
      if (!match) return null;
      buckets[section].push(match[1]);
    } else return null;
  }

  if (sections.size !== 6 || !summary || claimedHandoff === null) return null;
  if ([...KNOWN_GATES].some((name) => !Object.hasOwn(gates, name))) return null;
  for (const [bucket, key] of Object.entries(SUMMARY_KEYS)) {
    const count = buckets[bucket].length;
    if (declaredCounts[bucket] !== count || summary[key] !== count) return null;
  }

  // The verdict cannot overrule the evidence. Explicit refusal stays conservative.
  const handoffEligible =
    claimedHandoff &&
    buckets.blockers.length === 0 &&
    Object.values(gates).every((value) => value === "pass" || value === "n/a");
  return { ...buckets, gates, handoffEligible, summary };
}
