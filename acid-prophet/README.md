# acid-prophet

![acid-prophet](./assets/banner.png)

Spec-writing and spec-audit plugin for Claude Code and Codex.

It turns rough ideas into reviewed specs, audits specs against SDD expectations and codebase reality, and checks PR drift before merge.

## Skills

| Skill                      | Purpose                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| `acid-prophet:write-spec`  | Guide project discovery, propose approaches, write a spec, audit it, and optionally hand off to Linear |
| `acid-prophet:audit-spec`  | Audit an existing spec for structure, ambiguity, missing evidence, and codebase contradictions         |
| `acid-prophet:check-drift` | Compare a branch diff against the linked spec or Linear project criteria                               |

## Agent

| Agent          | Purpose                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------- |
| `spec-auditor` | Read-only spec auditor that returns BLOCKER/WARNING/INFO findings and auto-fix candidates |

## Install

Claude Code:

```text
/plugin marketplace add g-bastianelli/nuthouse
/plugin install acid-prophet@nuthouse
```

Codex CLI:

```text
codex plugin marketplace add g-bastianelli/nuthouse
```

Then open `/plugins` and install `acid-prophet`.

## Layout

```text
acid-prophet/
  assets/
  persona.md
  shared/
  skills/
  agents/
  lib/
  tests/
  claudecode/
    lib/
    tests/
```
