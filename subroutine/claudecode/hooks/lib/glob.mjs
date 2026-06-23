// Tiny zero-dependency glob matcher for subroutine path-activation.
//
// Supports the subset used by skill `paths` frontmatter (same flavour as
// Claude Code path-specific rules): `**` (any number of path segments), `*`
// (one segment, no `/`), `?` (one non-`/` char), and `{a,b}` brace alternation.
// Patterns are matched against the FULL (usually absolute) file path, so every
// pattern is expected to be `**/`-anchored — which all subroutine skills are.

const REGEX_SPECIALS = /[.+^$|()[\]\\]/;

/** Translate a glob string into an anchored RegExp. */
export function globToRegExp(glob) {
  let re = "^";
  let braceDepth = 0;
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/") {
          i++;
          // `**/` — zero or more whole path segments.
          re += "(?:[^/]*/)*";
        } else {
          // bare `**` — anything, crossing `/`.
          re += ".*";
        }
      } else {
        // `*` — one segment, no `/`.
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if (c === "{") {
      braceDepth++;
      re += "(?:";
    } else if (c === "}") {
      if (braceDepth > 0) {
        braceDepth--;
        re += ")";
      } else {
        re += "\\}";
      }
    } else if (c === "," && braceDepth > 0) {
      re += "|";
    } else if (REGEX_SPECIALS.test(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  return new RegExp(re + "$");
}

/** True if `filePath` matches `glob`. Path separators are normalised to `/`. */
export function matchGlob(glob, filePath) {
  const p = String(filePath || "").replace(/\\/g, "/");
  if (!p) return false;
  try {
    return globToRegExp(glob).test(p);
  } catch {
    return false;
  }
}
