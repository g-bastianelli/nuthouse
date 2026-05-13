const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---(\n[\s\S]*)?$/;

export function applyFrontmatterPatch(content, patches) {
  const match = content.match(FRONTMATTER_RE);
  if (!match) {
    throw new Error("frontmatter block not found or not terminated");
  }
  if (patches.length === 0) return content;

  const [, frontmatterBody, rest = ""] = match;
  const lines = frontmatterBody.split("\n");
  const patched = [...lines];

  for (const { key, value } of patches) {
    const lineIndex = patched.findIndex((l) => l.startsWith(`${key}:`));
    const newLine = `${key}: ${value}`;
    if (lineIndex >= 0) {
      patched[lineIndex] = newLine;
    } else {
      patched.push(newLine);
    }
  }

  return `---\n${patched.join("\n")}\n---${rest}`;
}
