# Baton 1.0 — Release Notes

## Überblick

Dieses Release ersetzt das manifest-basierte Konfigurationsmodell (pre-1.0) durch ein **Convention-over-Configuration**-Modell (Baton 1.0). Content wird nicht mehr in `baton.profile.yaml` deklariert, sondern aus der Dateisystem-Struktur automatisch entdeckt. Gleichzeitig wurde das Directive-System erheblich ausgebaut und die Merge-Strategien radikal vereinfacht.

---

## 1. Preview Command (NEU)

**Datei:** `packages/cli/src/commands/preview.ts` (557 Zeilen, komplett neu)

- `baton preview --tool <key>` zeigt den vollständig verarbeiteten Output für ein bestimmtes AI Tool
- Directive-Processing wird angewendet — man sieht das Endergebnis nach `baton:if`/`baton:include` Auswertung
- `--type <memory|rules|agents|skills|commands>` filtert auf einen Content-Typ
- `--diff <tool>` vergleicht den Output zwischen zwei Tools (z.B. `--diff cursor` vs `claude-code`)
- Nutzt die neue Filesystem Discovery Pipeline intern

---

## 2. Directive-System — Ausbau

### 2.1 `baton:else` Directive (NEU)

**Dateien:** `parser.ts`, `conditional.ts`, `processor.ts`, `types.ts`

- `<!-- baton:if tool="claude-code" -->` … `<!-- baton:else -->` … `<!-- baton:endif -->` wird jetzt unterstützt
- `ParsedDirective.type` erweitert: `"include" | "if" | "endif"` → `"include" | "if" | "else" | "endif"`
- `ConditionalBlock` hat jetzt ein optionales `elseDirective` Feld
- Verschachtelung funktioniert korrekt (Nesting-Depth-Tracking)

### 2.2 Expression-Based Conditions (NEU)

**Neues Modul:** `packages/core/src/directives/expression/` (5 Dateien)

- Tokenizer → Parser → Evaluator Pipeline für boolesche Ausdrücke
- Unterstützt: `AND`, `OR`, `NOT`, Klammern, Vergleichsoperatoren
- Ermöglicht komplexe Bedingungen: `<!-- baton:if expr="tool('claude-code') AND scope('project')" -->`
- Vollständige Test-Suite: `tokenizer.test.ts`, `parser.test.ts`, `evaluator.test.ts`

### 2.3 Condition Registry (NEU)

**Neues Modul:** `packages/core/src/directives/conditions/` (10 Dateien)

- Pluggable Condition-Funktionen: `tool`, `ide`, `scope`, `type`, `file`, `has`, `variable`
- `has()` Condition mit eigenem Registry (`has-registry.ts`) für Feature-Detection
- Jede Condition ist ein separates Modul mit klarem Interface
- `registry.ts` verwaltet alle Conditions zentral
- Condition-Auswertung ist jetzt **async** (für Filesystem-Checks wie `file()`)

### 2.4 Code Block Awareness (NEU)

**Datei:** `parser.ts`

- `findCodeBlockRanges()` erkennt Fenced Code Blocks (``` und ~~~)
- Directives innerhalb von Code Blocks werden ignoriert (kein versehentliches Processing von Beispiel-Code)

### 2.5 File Placement System (NEU)

**Dateien:** `placement.ts`, `processor.ts`, `types.ts`

- `FilePlacement` Type für profile-relative `baton:include` mit `mode="link"` / `mode="reference"`
- `computePlacementTarget()` berechnet Zielpfade unter `.baton/includes/<profile>/`
- `onPlacement` Callback im `DirectiveOptions` für Integration mit der Sync-Pipeline
- Kopiert referenzierte Dateien automatisch ins Projekt

### 2.6 Explain Mode (NEU)

**Datei:** `processor.ts`

- `explain: true` Option in `DirectiveOptions`
- Annotiert Conditional Blocks mit Evaluierungsergebnissen statt sie zu entfernen
- Nützlich für Debugging von Directive-Logik

### 2.7 Context-Erweiterungen

**Datei:** `types.ts` — `DirectiveContext` hat neue Felder:

- `profileRoot?: string` — Absoluter Pfad zum Profil-Verzeichnis
- `profileName?: string` — Profilname für Placement-Pfade
- `variables?: Record<string, string>` — User-definierte Variablen aus `baton.yaml`

---

## 3. Merge-Strategien — Radikal vereinfacht

### 3.1 Nur noch `concat` und `replace`

**Schema:** `mergeStrategySchema` reduziert von 8 auf 2 Werte:

```
// pre-1.0 (entfernt)
"replace" | "deep" | "append" | "prepend" | "skip" | "prompt" | "directory" | "import"

// Baton 1.0 (neu)
"concat" | "replace"
```

- `concat` — Inhalte werden mit `\n\n` verbunden (Default)
- `replace` — Letztes Profil gewinnt komplett

### 3.2 Entfernte Dateien

| Datei | Inhalt |
|---|---|
| `core/src/merge/strategies.ts` | Alle 8 Merge-Funktionen (`mergeReplace`, `mergeDeep`, `mergeAppend`, `mergePrepend`, `mergeSkip`, `mergePrompt`, `mergeDirectory`, `mergeImport`) |
| `core/src/merge/strategies.test.ts` | Zugehörige Tests |
| `core/src/merge/rules.test.ts` | Alte manifest-basierte Rule-Merge-Tests |
| `core/src/merge/skills.test.ts` | Alte manifest-basierte Skill-Merge-Tests |
| `core/src/merge/agents.test.ts` | Alte manifest-basierte Agent-Merge-Tests |
| `core/src/merge/memory.test.ts` | Alte manifest-basierte Memory-Merge-Tests |

### 3.3 Vereinfachte Merge-Module

Jedes Merge-Modul (`rules.ts`, `skills.ts`, `agents.ts`, `memory.ts`) wurde von ~100-150 Zeilen auf ~10-15 Zeilen reduziert:

- **Entfernt:** `mergeRules()`, `mergeRulesWithWarnings()`, `mergeSkills()`, `mergeSkillsWithWarnings()`, `mergeAgents()`, `mergeAgentsWithWarnings()`, `mergeMemory()`, `mergeMemoryWithWarnings()`
- **Entfernt:** Weight-basierte Conflict Detection, Lock-Mechanismus, per-tool Targeting via Manifest
- **Behalten:** Nur noch die Type-Definitionen (`RuleEntry`, `MergedSkillItem`, `AgentEntry`, `MemoryEntry`)
- Per-Tool Targeting wird jetzt über `baton:if` Directives im Content selbst gelöst

---

## 4. Filesystem Discovery (Convention-over-Configuration) (NEU)

### 4.1 Discovery Module

**Neues Modul:** `packages/core/src/discovery/` (6 Dateien)

- `discover.ts` — Scannt Profil-Verzeichnisse nach der Konvention:
  ```
  ai/memory/MEMORY.md
  ai/rules/*.md
  ai/agents/*.md
  ai/skills/<name>/SKILL.md
  ai/commands/*.md
  ai/mcp/*.yaml
  files/
  ide/<platform>/
  ```
- `assemble.ts` — Assembliert Discovery-Ergebnisse mehrerer Profile zu Merged-Content
- `types.ts` — Typen für alle Discovery-Ergebnisse (`DiscoveredRule`, `DiscoveredSkill`, etc.)
- Tests: `discover.test.ts` (330 Zeilen), `integration.test.ts` (450 Zeilen)

### 4.2 Frontmatter Parser (NEU)

**Neues Modul:** `packages/core/src/frontmatter/` (3 Dateien)

- Parst YAML Frontmatter aus Markdown-Dateien
- Extrahiert Baton-spezifische Keys (`scope`, `merge`, `globs`, `alwaysApply`, `description`)
- Selektives Stripping: Baton-Keys werden entfernt, Rest bleibt erhalten

---

## 5. Manifest-Schema — Breaking Changes

### 5.1 Entfernte Felder aus `baton.profile.yaml`

| Feld | Beschreibung |
|---|---|
| `ai.skills` | Skills-Array mit Name/Scope |
| `ai.rules` | Rules-Array oder Object mit Tool-Keys |
| `ai.agents` | Agents-Array oder Object mit Tool-Keys |
| `ai.memory` | Memory-Array mit Source/Merge/Scope |
| `ai.commands` | Commands-Array |
| `ai.mcp` | MCP-Server-Array |
| `files` | Files-Section mit Source/Target |
| `ide` | IDE-Section mit Platform-Keys |

### 5.2 Beibehaltene Felder

`name`, `description`, `version`, `extends`, `weight`, `scope`, `ai.tools`, `variables`, `hooks`

### 5.3 pre-1.0 Detection

- `detectV1Fields()` Funktion erkennt alte Manifest-Felder und gibt actionable Error-Messages
- Verweist auf Migration Guide in `docs/04-creating-profiles.md`

---

## 6. Entfernte Types und Exports

| Export | Modul |
|---|---|
| `SkillItem` | `schemas/profile-manifest.ts` |
| `MemoryItem` | `schemas/profile-manifest.ts` |
| `mergeRules()` / `mergeRulesWithWarnings()` | `merge/rules.ts` |
| `mergeSkills()` / `mergeSkillsWithWarnings()` | `merge/skills.ts` |
| `mergeAgents()` / `mergeAgentsWithWarnings()` | `merge/agents.ts` |
| `mergeMemory()` / `mergeMemoryWithWarnings()` | `merge/memory.ts` |
| `mergeReplace()`, `mergeDeep()`, `mergeAppend()`, `mergePrepend()`, `mergeSkip()`, `mergePrompt()`, `mergeDirectory()`, `mergeImport()` | `merge/strategies.ts` (gelöscht) |
| `MergeRulesResult`, `MergeSkillsResult`, `MergeAgentsResult`, `MergeMemoryResult` | Jeweilige Merge-Module |

---

## 7. CLI-Änderungen

- **`preview`** — Neuer Command (siehe Abschnitt 1)
- **`sync`** / **`apply`** — Umgebaut auf Filesystem Discovery als primären Pfad
- **`diff`** — Angepasst an neue Discovery-basierte Pipeline
- **Scaffold Templates** — Neue Directory-Struktur mit `.gitkeep` Dateien für `ai/agents/`, `ai/commands/`, `ai/mcp/`, `ai/rules/`, `ai/skills/`, `files/`, `ide/`
- **Team Template** — `baton.profile.yaml` vereinfacht, `ai.rules`/`ai.agents` Deklarationen entfernt
- **Cursor-spezifische Rule** (`code-style.mdc`) aus Team Template entfernt

---

## 8. Dokumentation

- `README.md` — Directives prominent featured
- `docs/03-creating-sources.md` — Aktualisiert
- `docs/04-creating-profiles.md` — Komplett überarbeitet für 1.0 Conventions (783 Zeilen geändert)
- `docs/07-configuration-reference.md` — Angepasst
- `docs/10-merge-strategies.md` — Von 8 auf 2 Strategien reduziert

---

## 9. Statistik

| Metrik | Wert |
|---|---|
| Commits | 17 |
| Neue Dateien | 40 |
| Gelöschte Dateien | 7 |
| Zeilen hinzugefügt | ~8.165 |
| Zeilen entfernt | ~5.852 |
| Netto | ~+2.313 Zeilen |
| Integration Tests (neu) | ~2.286 Zeilen (`directive-system.integration.test.ts`, `discover.test.ts`, `integration.test.ts`) |
