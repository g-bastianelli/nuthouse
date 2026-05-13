const SECTION_HEADERS = {
  blockers: /^##\s+BLOCKER\s*\(/,
  warnings: /^##\s+WARNING\s*\(/,
  infos: /^##\s+INFO\s*\(/,
  autoFixes: /^##\s+Auto-fix candidates\s*$/,
  summary: /^##\s+Summary\s*$/,
};

const SUMMARY_RE = /(\d+)\s+blocker\s*·\s*(\d+)\s+warning\s*·\s*(\d+)\s+info/i;
const BULLET_RE = /^-\s+(.+)$/;

export function parseScryerReport(raw) {
  if (typeof raw !== "string" || raw.length === 0) return null;

  const lines = raw.split("\n");
  const buckets = {
    blockers: [],
    warnings: [],
    infos: [],
    autoFixes: [],
  };
  let summary = null;
  let currentBucket = null;
  let inSummary = false;

  for (const line of lines) {
    if (SECTION_HEADERS.blockers.test(line)) {
      currentBucket = "blockers";
      inSummary = false;
      continue;
    }
    if (SECTION_HEADERS.warnings.test(line)) {
      currentBucket = "warnings";
      inSummary = false;
      continue;
    }
    if (SECTION_HEADERS.infos.test(line)) {
      currentBucket = "infos";
      inSummary = false;
      continue;
    }
    if (SECTION_HEADERS.autoFixes.test(line)) {
      currentBucket = "autoFixes";
      inSummary = false;
      continue;
    }
    if (SECTION_HEADERS.summary.test(line)) {
      currentBucket = null;
      inSummary = true;
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
  return { ...buckets, summary };
}
