# skill-issue

Marketplace de plugins Claude Code (et parfois Codex) perso. Trois plugins actuels : `saucy-status`, `react-monkey`, `linear-simp`.

Quand on crée un nouveau plugin/skill/agent, on reste dans ces choix par défaut. Toute exception se justifie.

---

## Stack & tooling

- **Runtime hooks/scripts** : Node.js, **ESM** (`import` / `export`). Extension **`.mjs`** obligatoire pour les hooks et tests (zéro ambiguïté pour Node, pas besoin de `package.json` dans le plugin, plugin self-contained quel que soit le contexte d'install). `saucy-status` reste en CJS pour raisons historiques. Tout nouveau plugin part en ESM `.mjs`. Pattern de référence : `linear-simp/claudecode/hooks/*.mjs`.
- **Package manager** : `bun@1.3.x` (déclaré dans `package.json` racine).
- **Tests** : `bun test` (built-in, pas de dep ajoutée). Tests dans `<plugin>/<runtime>/tests/`.
- **Lint/format** : `biome` (config dans `biome.json`). Formatter désactivé, linter actif. Règle locale : `noUnusedVariables` est on → utiliser `catch {}` (pas `catch (e)`) quand le binding est inutile.
- **Pre-commit** : `lefthook` lance `bunx biome check .`. **Jamais bypass** avec `--no-verify`.
- **Aucune dépendance npm/bun ajoutée** dans les plugins. Uniquement `node:fs`, `node:path`, `node:os`, `node:child_process`. Si un plugin a besoin d'une dep, en parler avant.

---

## Convention de nommage

### Plugins
Nom fun/absurde qui pose le thème : `saucy-status`, `react-monkey`, `linear-simp`. Ton brainrot/internet-meme assumé. Famille marketplace cohérente (saucy / monkey / simp).

### Skills
Verbe d'action ou gérondif décrivant ce que fait le skill :
- `implement`, `explore`, `greet`, `writing-plans`, `systematic-debugging`
- Pas de noms de rôle génériques (`coder`, `helper`, `utils`)
- **Codex** : `name:` du `SKILL.md` court et sans préfixe plugin. Le préfixe vient du plugin → `react-monkey` + `implement` = `$react-monkey:implement`.
- **Claude Code** : `name:` du `SKILL.md` inclut le préfixe complet (`name: react-monkey:implement`). Claude Code ne doit pas exposer `/implement` seul.
- Même capability peut avoir deux noms internes selon runtime, mais l'ID visible reste préfixé dans les deux cas.

### Agents
Nom de rôle ou de tâche descriptif :
- `explorer`, `gooner`, `code-reviewer`, `security-analyzer`
- Pas de noms vagues (`agent`, `helper`)
- Frontmatter `name:` **sans préfixe plugin** (le runtime ajoute le préfixe automatiquement). Ex : `name: gooner` → exposé comme `linear-simp:gooner`.

### IDs résultants
```
react-monkey:implement   ✅
react-monkey:explorer    ✅
linear-simp:greet        ✅
linear-simp:gooner       ✅
implement                ❌  (pas d'ID visible sans préfixe plugin)
react-monkey:coder       ❌  (nom de rôle générique pour un skill)
react-coder:react-coder  ❌  (doublon plugin/skill)
```

---

## Structure de plugin

### Plugin Claude Code seul
```
<plugin-name>/
├── README.md                    # anglais, banner en haut, install snippet
├── assets/
│   └── banner.png               # bannière 3:1, intégrée au README
└── claudecode/
    ├── .claude-plugin/
    │   └── plugin.json          # déclare hooks et metadata
    ├── hooks/                   # scripts Node CommonJS, optionnel
    ├── skills/<skill-name>/
    │   └── SKILL.md             # frontmatter avec name préfixé
    ├── agents/                  # subagents dédiés, optionnel
    │   └── <agent-name>.md
    ├── tests/                   # bun test, optionnel
    └── data/
        └── .gitignore           # state runtime gitignored
```

### Plugin cross-runtime (Claude Code + Codex)
Cf. `react-monkey/` pour le pattern : un dossier `claudecode/` et un `codex/`, chacun complet et autonome. Skills bundlés dans les deux runtimes avec les ajustements de naming ci-dessus.

### Inscription marketplace
Ajouter une entrée dans `.claude-plugin/marketplace.json` racine. **Source `git-subdir`** pour pouvoir versionner :
```json
{
  "name": "<plugin-name>",
  "source": {
    "source": "git-subdir",
    "url": "https://github.com/g-bastianelli/skill-issue",
    "path": "<plugin-name>/claudecode"
  },
  "category": "productivity" | "fun"
}
```
Et ajouter une ligne dans le tableau du `README.md` racine.

---

## Patterns architecturaux

### Hooks (détection / état début de session)
- **`SessionStart`** : firing au démarrage. Lit la branche, l'environnement. Peut écrire un `additionalContext` pour forcer l'invocation d'un skill.
- **`UserPromptSubmit`** : firing à chaque prompt. Pour détecter quelque chose au **1er prompt** uniquement, utiliser un state file qui marque `awaiting_prompt: true` au SessionStart, et qui ferme la fenêtre après le 1er.
- Pattern de fichier : `${CLAUDE_PLUGIN_ROOT}/data/state-<session_id>.json`.
- **Anti-redéclenchement** : flag `greeted: true` (ou équivalent) une fois le skill exécuté.
- **Cleanup paresseux** : supprimer les state files > 7 jours au SessionStart, best-effort, exceptions silencieuses.
- **Stdin JSON** : Claude Code passe `{session_id, prompt, ...}` au hook via stdin. Lire avec `fs.readFileSync(0, 'utf8')` puis `JSON.parse`.
- **Output `additionalContext`** :
  ```js
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart' | 'UserPromptSubmit',
      additionalContext: '<EXTREMELY-IMPORTANT>...</EXTREMELY-IMPORTANT>'
    }
  }))
  ```

### Subagents (économie de contexte)
- **Toujours dispatcher en subagent** les opérations lourdes (fetch MCP, lecture fichiers, parsing). Le main context ne reçoit que le résultat synthétisé.
- **Subagent dédié** (fichier `agents/<name>.md`) quand :
  - On dispatche le même worker plusieurs fois avec les mêmes instructions
  - On veut un tools allowlist strict (ex : read-only)
  - L'agent est réutilisable par d'autres skills
- **Subagent générique** (`general-purpose` avec prompt embed dans le SKILL.md) seulement pour des cas one-shot très contextuels.
- **Tools allowlist explicite** dans le frontmatter `tools:` quand on veut restreindre. Ex pour un agent read-only :
  ```yaml
  tools:
    - mcp__claude_ai_Linear__get_issue
    - mcp__claude_ai_Linear__list_comments
    - Read
    - Glob
    - Bash
  ```
- **Modèle adapté** dans le frontmatter `model:` :
  - `claude-haiku-4-5-20251001` pour parsing mécanique, fetch + résumé
  - Modèle par défaut pour réflexion / décision / écriture de code
- **Format d'input** standard pour l'agent : message structuré court (`ISSUE_ID: ...`, `PROJECT_ROOT: ...`).
- **Format d'output** : strictement défini dans le frontmatter, pas de prose libre.

### Format des briefs / specs (input pour agents IA)
Standard 2025 = **Spec-Driven Development (SDD)**, pas STAR. Sections :
- **Goal** (1 phrase)
- **Context** (pourquoi, archi)
- **Files referenced** (★ grounding crucial)
- **Constraints** (stack, perf, compliance)
- **Acceptance criteria** (vérifiables)
- **Non-goals** (out of scope)
- **Edge cases & ambiguities**
- **Suggested clarifying questions**

Champs manquants → `_unclear_` + question. Jamais inventer.

Sources : Thoughtworks, GitHub, JetBrains, O'Reilly, Addy Osmani — tous publient SDD comme standard 2025 pour les issues destinées aux agents IA. STAR (Situation/Task/Action/Result) vient des entretiens RH, sous-optimal pour des agents.

### Voix / persona
Ton brainrot/fun cohérent par plugin :
- `saucy-status` : suggestif, mode gooning
- `react-monkey` : créature compétente, voix neutre-fun
- `linear-simp` : simp dévoué (yes king, the gooner came back boss)

**Les actions restent sérieuses** — l'humour est dans la voix uniquement. Pas de side-effects fantaisistes.

---

## Workflow de dev d'un nouveau plugin/skill

1. **Brainstorming** — naming (cf. plus haut), persona, scope.
2. **SPEC** (optionnel) — colocalisé dans `<plugin>/SPEC.md` si utile comme doc de référence. Sinon pas de spec écrit, on passe direct au plan.
3. **PLAN** — peut utiliser `superpowers:writing-plans` comme **outil de travail**. Le plan vit dans `docs/superpowers/plans/...` pendant le dev, **mais est supprimé avant livraison**. Aucune dépendance superpowers ne doit fuiter dans le plugin livré.
4. **TDD** pour tout helper Node ou logique non triviale (`bun test`).
5. **Subagent-driven dev** — dispatcher un subagent fresh par task lourde, garder le main context pour la coordination.
6. **Commits fréquents** : un commit par étape logique (`feat(<plugin>): scaffold...`, `feat(<plugin>): add state.js helper`, etc.). Co-author tag pas systématique.

### Vérifications avant push
```bash
bunx bun test <plugin>/                    # tous tests passent
bunx biome check .                          # lint clean
node -e "JSON.parse(require('node:fs').readFileSync('.claude-plugin/marketplace.json', 'utf8'))"  # JSON valide
grep -rn "superpower\|writing-plans" <plugin>/   # aucune fuite superpowers
```

### Décisions par défaut
- README en **anglais** (cohérence avec saucy-status, react-monkey).
- Banner PNG dans `<plugin>/assets/banner.png`, intégrée en haut du README via `![](./assets/banner.png)`.
- License **MIT**.
- `data/.gitignore` pour les state files runtime.
- Squash-merge sur main via PR GitHub (workflow user — pas de merge direct).

---

## Anti-patterns à éviter

- ❌ Polluer le main context avec des fetch MCP / lectures massives → **toujours dispatcher en subagent**
- ❌ Embed un prompt subagent long dans un SKILL.md quand il sera réutilisé → **agent dédié dans `agents/`**
- ❌ Subagent sans tools allowlist quand il devrait être read-only → **lister explicitement les tools**
- ❌ Format STAR pour des briefs destinés à un agent → **SDD**
- ❌ Mutations Linear (ou autre service externe) sans confirmation user, sauf intention explicite documentée
- ❌ `git push`, `git commit`, `git rebase` exécutés silencieusement par un skill → **jamais**
- ❌ Dépendance `superpowers:*` dans le plugin livré → **artifacts de dev seulement, supprimés avant push**
- ❌ Ajouter une dep npm/bun "juste pour ce plugin" → **discuter d'abord**
- ❌ Bypass pre-commit hook avec `--no-verify` → **jamais**
- ❌ Banner en français quand le README est en anglais (cohérence visuelle)

---

## Plugins existants — résumé rapide

| Plugin | Quoi | Hooks | Skills | Agents |
|---|---|---|---|---|
| `saucy-status` | Loading messages saucy/gooning dans statusline | SessionStart, UserPromptSubmit | — | — |
| `react-monkey` | Implementation specialist React, parallel exploration | — | `implement` | `explorer` |
| `linear-simp` | Détection issue Linear début de session, brief SDD | SessionStart, UserPromptSubmit | `greet` | `gooner` |
