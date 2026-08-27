// Pure, side-effect-free detection of git branch-creation commands.
//
// Monkey Maestro's spawn hook intercepts attempts to create a branch in place
// (`git checkout -b`, `git switch -c`, `git branch <new>`) and redirects them
// to one task-linked Superset workspace. This parser never touches process or
// filesystem state.

const SHELL_SEPARATORS = /(?:&&|\|\||[;\n|])/;

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

const SUBCOMMANDS = new Set(["checkout", "switch", "branch"]);

const subcommandSlice = (tokens) => {
  const gitIndex = tokens.indexOf("git");
  if (gitIndex === -1) return null;
  for (let index = gitIndex + 1; index < tokens.length; index += 1) {
    if (SUBCOMMANDS.has(tokens[index])) {
      return { subcommand: tokens[index], arguments: tokens.slice(index + 1) };
    }
  }
  return null;
};

const valueAfterFlag = (arguments_, flagIndex) => {
  for (let index = flagIndex + 1; index < arguments_.length; index += 1) {
    if (!arguments_[index].startsWith("-")) return arguments_[index];
  }
  return null;
};

const detectInSegment = (segment) => {
  const tokens = tokenize(segment);
  if (tokens.length === 0) return null;
  const found = subcommandSlice(tokens);
  if (!found) return null;
  const { subcommand, arguments: arguments_ } = found;

  if (subcommand === "checkout") {
    const index = arguments_.findIndex((argument) => argument === "-b" || argument === "-B");
    if (index === -1) return null;
    return { branch: valueAfterFlag(arguments_, index), kind: "checkout-b" };
  }
  if (subcommand === "switch") {
    const index = arguments_.findIndex((argument) =>
      ["-c", "-C", "--create", "--force-create"].includes(argument),
    );
    if (index === -1) return null;
    return { branch: valueAfterFlag(arguments_, index), kind: "switch-c" };
  }

  const copyIndex = arguments_.findIndex((argument) => ["-c", "-C", "--copy"].includes(argument));
  if (copyIndex !== -1) {
    return { branch: valueAfterFlag(arguments_, copyIndex), kind: "branch-copy" };
  }
  if (arguments_.some((argument) => GIT_BRANCH_NONCREATE_FLAGS.has(argument))) return null;
  const positional = arguments_.find((argument) => !argument.startsWith("-"));
  return positional ? { branch: positional, kind: "branch-create" } : null;
};

export const detectBranchCreation = (command) => {
  if (typeof command !== "string" || command.trim() === "") return null;
  for (const segment of command.split(SHELL_SEPARATORS)) {
    const match = detectInSegment(segment);
    if (match) return match;
  }
  return null;
};
