// Pure, side-effect-free detection of git branch-CREATION commands.
//
// The git-gremlin spawn hook intercepts attempts to create a branch in place
// (`git checkout -b`, `git switch -c`, `git branch <new>`) and redirects them
// to a per-branch Superset workspace. This module is the parser only — it never
// touches stdin, the filesystem, or process state, so it is trivially testable.
//
// Returns the detected new-branch name + which form triggered it, or null when
// the command does not create a branch (list / delete / rename / switch to an
// existing branch / unrelated command).

const SHELL_SEPARATORS = /(?:&&|\|\||[;\n|])/;

// `git branch` flags that mean "this is NOT a fresh-branch creation we care about"
// (inspection, deletion, rename, upstream wiring). Copy (-c/-C/--copy) is handled
// separately because it DOES create a new branch.
const GIT_BRANCH_NONCREATE_FLAGS = new Set([
  "-d",
  "-D",
  "--delete",
  "-m",
  "-M",
  "--move",
  "-l",
  "--list",
  "-a",
  "--all",
  "-r",
  "--remotes",
  "--show-current",
  "--edit-description",
  "--set-upstream-to",
  "-u",
  "--unset-upstream",
  "--contains",
  "--no-contains",
  "--merged",
  "--no-merged",
  "--points-at",
  "-v",
  "-vv",
  "--verbose",
  "--format",
  "--sort",
  "--color",
  "--column",
  "--no-column",
]);

const stripQuotes = (token) => {
  if (token.length >= 2) {
    const first = token[0];
    const last = token[token.length - 1];
    if ((first === '"' || first === "'" || first === "`") && first === last) {
      return token.slice(1, -1);
    }
  }
  return token;
};

const tokenize = (segment) =>
  segment.trim().split(/\s+/).filter(Boolean).map(stripQuotes).filter(Boolean);

// From a token list, return the slice starting at the first git subcommand
// keyword (checkout / switch / branch), skipping `git` and any global options
// before it (`-C <path>`, `-c key=val`, `--git-dir=...`, etc.). Returns null if
// this segment is not a git invocation with one of those subcommands.
const SUBCOMMANDS = new Set(["checkout", "switch", "branch"]);

const subcommandSlice = (tokens) => {
  const gitIdx = tokens.indexOf("git");
  if (gitIdx === -1) return null;
  for (let i = gitIdx + 1; i < tokens.length; i++) {
    if (SUBCOMMANDS.has(tokens[i])) {
      return { sub: tokens[i], args: tokens.slice(i + 1) };
    }
  }
  return null;
};

// Find the branch name following a create flag (-b/-c/--create...). The name is
// the next token that is not itself an option. Returns null if absent.
const valueAfterFlag = (args, flagIdx) => {
  for (let i = flagIdx + 1; i < args.length; i++) {
    if (!args[i].startsWith("-")) return args[i];
  }
  return null;
};

const detectInSegment = (segment) => {
  const tokens = tokenize(segment);
  if (tokens.length === 0) return null;

  const found = subcommandSlice(tokens);
  if (!found) return null;
  const { sub, args } = found;

  if (sub === "checkout") {
    const idx = args.findIndex((a) => a === "-b" || a === "-B");
    if (idx === -1) return null;
    return { branch: valueAfterFlag(args, idx), kind: "checkout-b" };
  }

  if (sub === "switch") {
    const idx = args.findIndex(
      (a) => a === "-c" || a === "-C" || a === "--create" || a === "--force-create",
    );
    if (idx === -1) return null;
    return { branch: valueAfterFlag(args, idx), kind: "switch-c" };
  }

  // sub === "branch"
  // Copy creates a new branch → intercept.
  const copyIdx = args.findIndex((a) => a === "-c" || a === "-C" || a === "--copy");
  if (copyIdx !== -1) {
    return { branch: valueAfterFlag(args, copyIdx), kind: "branch-copy" };
  }
  // Any inspection / delete / rename / upstream flag → not a creation we gate.
  if (args.some((a) => GIT_BRANCH_NONCREATE_FLAGS.has(a))) return null;
  // `git branch <name> [start-point]` with a bare positional → creation.
  const positional = args.find((a) => !a.startsWith("-"));
  if (positional) return { branch: positional, kind: "branch-create" };
  // `git branch` alone (list) → allow.
  return null;
};

// Public API: scan a full command line (possibly compound) and return the first
// branch-creation it finds, or null.
export const detectBranchCreation = (command) => {
  if (typeof command !== "string" || command.trim() === "") return null;
  for (const segment of command.split(SHELL_SEPARATORS)) {
    const hit = detectInSegment(segment);
    if (hit) return hit;
  }
  return null;
};
