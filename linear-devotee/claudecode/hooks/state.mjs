const ISSUE_ID_RE = /\b([a-z]{2,6})-([0-9]{2,})\b/i;
const URL_RE = /https?:\/\/\S+/gi;

export function extractIssueId(input) {
  if (!input || typeof input !== 'string') return null;
  const withoutUrls = input.replace(URL_RE, '');
  const stripped = withoutUrls.includes('/') ? withoutUrls.slice(withoutUrls.indexOf('/') + 1) : withoutUrls;
  const m = stripped.match(ISSUE_ID_RE);
  if (!m) return null;
  return `${m[1].toUpperCase()}-${m[2]}`;
}
