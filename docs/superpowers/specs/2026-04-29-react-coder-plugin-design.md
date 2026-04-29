# react-coder Plugin — Design Spec

**Date:** 2026-04-29
**Auteur:** g-bastianelli
**Statut:** Approuvé

---

## Contexte

Le skill `react-coder` existe aujourd'hui comme skill global dans `~/.claude/skills/react-coder/SKILL.md`. Les amis veulent l'utiliser — il faut donc le transformer en **plugin distribuable** via ce repo marketplace, et en profiter pour l'améliorer avec les best practices Claude Code 2026.

---

## Objectif

Migrer `react-coder` dans ce repo sous forme de plugin installable, et ajouter un **subagent d'exploration parallèle** qui pré-charge le contexte (design system, data fetching, code existant) avant l'implémentation.

---

## Architecture

### Structure du plugin

```
react-coder/
├── .claude-plugin/
│   └── plugin.json          # déclaration plugin (nom, skills, agents)
├── skills/
│   └── react-coder/
│       └── SKILL.md         # skill principal amélioré
├── agents/
│   └── react-explorer/
│       └── AGENT.md         # subagent d'exploration parallèle
└── README.md
```

Pas de hooks (SessionStart / UserPromptSubmit) — le skill se déclenche à la demande sur détection de travail React, pas au démarrage de session.

---

## Composants

### 1. `plugin.json`

Déclare le plugin avec :
- `name`: `react-coder`
- `description`: description courte du plugin
- `author`: `{ "name": "g-bastianelli" }`
- Pas de `hooks` (contrairement à saucy-status)

Les skills et agents sont **auto-découverts** par Claude Code depuis les dossiers `skills/` et `agents/` — pas besoin de les déclarer explicitement dans `plugin.json`.

Le plugin est référencé dans `marketplace.json` à la racine :
```json
{ "name": "react-coder", "source": "./react-coder", "category": "productivity" }
```

### 2. Skill principal (`skills/react-coder/SKILL.md`)

**Frontmatter :**
```yaml
---
name: react-coder
description: Use when creating, refactoring, or implementing React components, hooks, or pages — including .tsx/.jsx files, component trees, data fetching hooks, and UI layouts
---
```

**Modifications par rapport au skill actuel :**

1. **TaskCreate au démarrage** — crée une task par grande étape (Exploration, Plan, Implémentation, Checks) pour que l'utilisateur voie la progression dans l'UI.

2. **Étapes 2+3+4 fusionnées** — au lieu de 3 étapes séquentielles de recherche inline, le skill spawne l'agent `react-explorer` via le tool `Agent` (modèle Haiku) et reçoit un rapport structuré unique. Cela libère le contexte principal des résultats de recherche bruts.

3. **Le reste est inchangé** — les 5 rules (one component per file, folder mirrors JSX tree, IDs-only props, shared select hook, split large components), les sections styling, data fetching, state management, TypeScript, hooks, accessibility, et la checklist 17 items restent intactes. Ce sont les règles métier du skill — on ne les touche pas.

### 3. Subagent `react-explorer` (`agents/react-explorer/AGENT.md`)

**Rôle :** Exploration parallèle du codebase pour pré-charger le contexte avant l'implémentation React.

**Input :** chemin du composant/feature cible + répertoire racine du projet.

**Ce qu'il fait — 3 recherches en parallèle :**

| Tâche | Cibles | Outil |
|-------|--------|-------|
| Design system | `ds/`, `ui/`, `design-system/`, `components/` — tokens (colors, spacing, typography), composants disponibles (Button, Dialog, Badge, Input…) | Explore (Bash/Read/Grep) |
| Data fetching | `package.json` (librairie), 2-3 hooks existants, pattern `select`, suspense activé ou non, global state | Explore |
| Code environnant | composants siblings dans le même dossier, hooks colocalisés, types | Explore |

**Output structuré :**
```markdown
## Design System
- Composants disponibles : Button, Dialog, Badge, Input, Select…
- Tokens spacing : gap-sm, gap-md, p-lg…
- Tokens colors : text-primary, bg-surface…

## Data Fetching
- Librairie : React Query v5
- Suspense : activé
- Pattern select : oui (ex: useContactQuery.ts:42)
- Global state : Zustand (UI state only)

## Code existant
- Siblings : ContactCard.tsx, ContactHeader.tsx
- Hooks partagés : useContact.ts, useDeal.ts
- Pattern props : IDs uniquement (ex: ContactCard.tsx:8)
```

**Modèle :** Haiku (suffisant pour la lecture de code, moins coûteux).

---

## Flow complet

```
Utilisateur travaille sur React
        ↓
skill react-coder s'auto-invoque
        ↓
TaskCreate: [Exploration] [Plan] [Implémentation] [Checks]
        ↓
[Exploration] → Agent(react-explorer, haiku) spawné
        ↓         ┌── DS discovery
                  ├── Data fetching discovery   (parallèle)
                  └── Surrounding code discovery
        ↓
Rapport structuré retourné au skill
        ↓
[Plan] → Sketch JSX tree + folder structure (step 5 actuel)
        ↓
[Implémentation] → Écriture des composants/hooks
        ↓
[Checks] → Checklist 17 items + lint/typecheck
```

L'utilisateur ne spawne rien manuellement — tout est orchestré par le skill.

---

## Hors scope

- Hooks SessionStart/UserPromptSubmit (pas nécessaires pour ce plugin)
- Agent de code review post-implémentation (peut être ajouté plus tard — `superpowers:requesting-code-review` couvre déjà ce besoin)
- Support d'autres frameworks (Vue, Svelte…)
- Génération autonome sans supervision (approche C rejetée)

---

## Distribution

Le plugin s'installe via ce repo marketplace exactement comme `saucy-status`. Les amis l'ajoutent à leur `marketplace.json` et les skills/agents sont auto-découverts.
