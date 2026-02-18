# Baton - Development Context

## What is Baton

Baton is a CLI package manager for Developer Experience & AI configuration. It manages Skills, Rules, Agents, Memory Files, Commands, and file configs as versioned, composable profiles for 14 AI coding tools. Think of it as "npm for DX configs" — source repositories contain profiles that get resolved, merged, transformed, and placed into the correct format for each AI tool.

## Architecture

```
@baton-dx/agent-paths  ←  @baton-dx/core  ←  @baton-dx/cli
(path registry)            (logic layer)       (user interface)
```

**Dependency flow:** `agent-paths` has zero dependencies. `core` depends on `agent-paths`. `cli` depends on `core`.

## Packages

### @baton-dx/cli (`packages/cli/`)

The user-facing CLI built with [citty](https://github.com/unjs/citty) + [@clack/prompts](https://github.com/natemoo-re/clack).

- **Entry:** `src/index.ts` — defines all commands and global flags
- **Commands:** `src/commands/` — one file or directory per command
- **Templates:** `src/templates/` — scaffold templates (minimal, team, enterprise)

### @baton-dx/core (`packages/core/`)

All business logic lives here. No CLI or UI concerns.

- **Adapters:** `src/adapters/` — 14 AI tool adapters implementing `ToolAdapter`
  - `types.ts` — `ToolAdapter` interface and canonical data types
  - `base-adapter.ts` — `BaseAdapter` abstract class with shared defaults
  - `registry.ts` — `getAdapter()`, `getAllAdapters()`, `getAdaptersForKeys()`
  - One file per tool: `claude-code.ts`, `cursor.ts`, `windsurf.ts`, etc.
- **Schemas:** `src/schemas/` — Zod schemas (single source of truth for all config validation)
- **Merge:** `src/merge/` — merge strategies (replace, deep, append, prepend, skip, prompt, directory, import)
- **Sources:** `src/sources/` — source resolution (GitHub, GitLab, npm, file, git)
- **Detection:** `src/detection/` — auto-detect installed AI tools and IDEs
- **IDE:** `src/ide/` — IDE platform registry and settings placement
- **Lockfile:** `src/lockfile/` — lockfile read/write with SHA-256 integrity
- **Placement:** `src/placement/` — file placement engine
- **Migration:** `src/migration/` — legacy config migration
- **Substitution:** `src/substitution/` — template variable replacement (`{{var}}`)

### @baton-dx/agent-paths (`packages/agent-paths/`)

Zero-dependency path registry for all 14 AI tools.

- **Registry:** `src/registry.ts` — `AGENT_PATHS` array with path configs for each tool
- **Config types:** skills, rules, agents, memory, settings, commands
- **Scopes:** project (`.tool/`) and global (`~/.tool/`)
- **Exports:** `getAgentPath()`, `getAgentPaths()`, `getAllAgentKeys()`

## CLI Commands

| Command | Description |
|---------|-------------|
| `baton init` | Initialize Baton in your project (interactive wizard) |
| `baton sync` | Resolve, merge, transform, and place all configs |
| `baton update` | Check for and apply updates to installed packages |
| `baton diff` | Compare local files with remote source versions |
| `baton manage` | Interactive project management wizard |
| `baton config` | Show dashboard overview or configure settings |
| `baton source create <name>` | Scaffold a new source repository |
| `baton source list` | List registered global sources |
| `baton source connect <url>` | Register a source repository globally |
| `baton source disconnect <name>` | Remove a global source registration |
| `baton profile create <name>` | Create a new profile in a source repo |
| `baton profile list` | List profiles in current source or project |
| `baton profile remove <name>` | Remove a profile from the project |
| `baton ai-tools scan` | Detect installed AI tools |
| `baton ai-tools list` | List configured AI tools |
| `baton ides scan` | Detect installed IDE platforms |
| `baton ides list` | List configured IDE platforms |

**Global flags:** `--yes/-y` (non-interactive), `--dry-run`, `--verbose`, `--version/-v`

## Key Schemas

| Schema | File | Config File |
|--------|------|-------------|
| `ProjectManifest` | `core/src/schemas/project-manifest.ts` | `baton.yaml` |
| `ProfileManifest` | `core/src/schemas/profile-manifest.ts` | `baton.profile.yaml` |
| `SourceManifest` | `core/src/schemas/source-manifest.ts` | `baton.source.yaml` |
| `LockFile` | `core/src/schemas/lockfile.ts` | `baton.lock` |
| `GlobalConfig` | `core/src/schemas/global-config.ts` | `~/.baton/config.yaml` |

All schemas use Zod. Derive TypeScript types with `z.infer<typeof schema>`.

## Adapter Pattern

Every AI tool adapter implements the `ToolAdapter` interface (`core/src/adapters/types.ts`):

```typescript
interface ToolAdapter {
  key: string;                    // e.g. "claude-code"
  name: string;                   // e.g. "Claude Code"
  isInstalled(): Promise<boolean>;
  getPath(type, scope, name): string;
  getLegacyPaths(type): string[];
  transformSkill(skill): SkillDir;
  transformRule(rule): RuleFile;
  transformAgent(agent): AgentFile;
  transformMemory(memory): MemoryFile;
  transformCommand(command): CommandFile;
  validate(type, file): ValidationResult;
}
```

Most adapters extend `BaseAdapter` (`base-adapter.ts`) which provides sensible defaults. Override only what differs — e.g., Cursor overrides `transformRule()` for `.mdc` format, Windsurf strips frontmatter.

**14 supported tools:** claude-code, cursor, windsurf, antigravity, codex, github-copilot, opencode, amp, kiro, zed, cline, roo, junie, trae

## Merge Strategies

| Strategy | Behavior |
|----------|----------|
| `replace` | Target completely replaced with source |
| `deep` | JSON/YAML deep merge (source keys override) |
| `append` | Source appended to target with separator |
| `prepend` | Source prepended to target with separator |
| `skip` | Only write if target doesn't exist |
| `prompt` | Ask user interactively (replace/skip/diff) |
| `directory` | Directory merge: add new files, overwrite existing |
| `import` | Add `@import` reference line to target |

Defined in `core/src/merge/strategies.ts`.

## IDE Platforms

6 supported IDE platforms (`core/src/ide/platform-registry.ts`):

| Platform | Target Dir | Detection |
|----------|-----------|-----------|
| VS Code | `.vscode` | `code` binary, `~/.vscode/` |
| JetBrains | `.idea` | `idea` binary, `~/.config/JetBrains/` |
| Cursor | `.cursor` | `cursor` binary, `~/.cursor/` |
| Windsurf | `.windsurf` | `windsurf` binary, `~/.windsurf/` |
| Antigravity | `.antigravity` | `antigravity` binary, `~/.antigravity/` |
| Zed | `.config/zed` | `zed` binary, `~/.config/zed/` |

## Development Commands

```bash
bun run build       # Build all packages (tsup)
bun run test        # Run tests (vitest)
bun run lint        # Lint with Biome
bun run typecheck   # TypeScript strict check
bun run dead-code   # Find unused exports (ts-prune)
```

## Development Conventions

- **TypeScript strict mode** — no `any` types, use `unknown` + type narrowing
- **Named exports only** — no `export default`
- **Functional composition** — except for adapters which use class inheritance (`BaseAdapter`)
- **Zod schemas as source of truth** — derive types with `z.infer<typeof schema>`
- **Tests co-located** — `foo.test.ts` next to `foo.ts` (vitest)
- **Async file I/O** — always `fs/promises`, never sync
- **Conventional commits** — `feat(cli):`, `fix(core):`, `refactor(agent-paths):`
- **Biome formatting** — run `bun run lint` before committing
- **Import ordering** — Node built-ins → external packages → workspace packages → relative imports

## Skills (for Contributors)

Available skills in `.claude/skills/`:

| Skill | Purpose |
|-------|---------|
| `add-adapter` | Add a new AI tool adapter (all 3 packages) |
| `add-ide-platform` | Add a new IDE platform to Baton |
| `code-reviewer` | Run code quality review |
| `dead-code` | Find unused exports and dead code |
| `redundancy-finder` | Find duplicate logic across the monorepo |
| `review` | Comprehensive project review |
| `pr` | Create well-documented pull requests |
| `release-checklist` | Walk through the release process |

## Agents (for Contributors)

Available agents in `.claude/agents/`:

| Agent | Purpose |
|-------|---------|
| `code-quality-auditor` | Deep code quality analysis with isolated context |
| `consolidation-scout` | Find consolidation opportunities across the monorepo |
