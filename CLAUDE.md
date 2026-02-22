# Baton DX — Monorepo Architecture

## Architecture

```
@baton-dx/ai-tool-paths  ←  @baton-dx/core  ←  @baton-dx/cli
(path registry)              (logic layer)       (user interface)
```

**Dependency flow:** `ai-tool-paths` has zero dependencies. `core` depends on `ai-tool-paths`. `cli` depends on `core`. One direction only — never reverse.

**Publishing:** Only `@baton-dx/cli` is published to npm. `core` and `ai-tool-paths` are `"private": true` — they are bundled into the CLI build via tsdown's `noExternal` + `alias` config (see `packages/cli/tsdown.config.ts`). The published CLI package has zero runtime dependencies; everything is self-contained in `dist/index.mjs`.

## Packages

### @baton-dx/cli (`packages/cli/`)

The user-facing CLI built with [citty](https://github.com/unjs/citty) + [@clack/prompts](https://github.com/natemoo-re/clack).

- **Entry:** `src/index.ts` — defines all commands and global flags
- **Commands:** `src/commands/` — one file or directory per command
- **Templates:** `src/templates/` — scaffold templates (minimal, team, enterprise)

### @baton-dx/core (`packages/core/`)

All business logic lives here. No CLI or UI concerns.

- **Adapters:** `src/adapters/` — 14 AI tool adapters implementing `AIToolAdapter`
  - `types.ts` — `AIToolAdapter` interface and canonical data types
  - `base-adapter.ts` — `BaseAIToolAdapter` abstract class with shared defaults
  - `registry.ts` — `getAIToolAdapter()`, `getAllAIToolAdapters()`, `getAIToolAdaptersForKeys()`
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
- **Inheritance:** `src/inheritance/` — profile chain resolution

### @baton-dx/ai-tool-paths (`packages/ai-tool-paths/`)

Zero-dependency path registry for all 14 AI tools.

- **Registry:** `src/registry.ts` — `AI_TOOL_PATHS` array with path configs for each tool
- **Config types:** skills, rules, agents, memory, commands
- **Scopes:** project (`.tool/`) and global (`~/.tool/`)
- **Exports:** `getAIToolPath()`, `getAIToolPaths()`, `getAllAIToolKeys()`

## Key Schemas (Zod)

| Schema | File | Config File |
| ----------------- | ------------------------------------------ | --------------------- |
| `ProjectManifest` | `core/src/schemas/project-manifest.ts` | `baton.yaml` |
| `ProfileManifest` | `core/src/schemas/profile-manifest.ts` | `baton.profile.yaml` |
| `SourceManifest` | `core/src/schemas/source-manifest.ts` | `baton.source.yaml` |
| `LockFile` | `core/src/schemas/lockfile.ts` | `baton.lock` |
| `GlobalConfig` | `core/src/schemas/global-config.ts` | `~/.baton/config.yaml` |

All schemas use Zod. Derive TypeScript types with `z.infer<typeof schema>`.

## Adapter Pattern

Every AI tool adapter implements the `AIToolAdapter` interface (`core/src/adapters/types.ts`):

```typescript
interface AIToolAdapter {
  key: string;
  name: string;
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

Most adapters extend `BaseAIToolAdapter` (`base-adapter.ts`) which provides sensible defaults. Override only what differs — e.g., Cursor overrides `transformRule()` for `.mdc` format, Windsurf strips frontmatter, Antigravity uses `GEMINI.md`, GitHub Copilot uses `copilot-instructions.md`.

## CLI Commands

| Command | Description |
| --------------------------------- | ----------------------------------------------- |
| `baton init` | Initialize Baton in your project (interactive wizard) |
| `baton sync` | Resolve, merge, transform, and place all configs |
| `baton update` | Check for and apply updates |
| `baton diff` | Compare local files with remote source versions |
| `baton manage` | Interactive project management wizard |
| `baton config` | Show dashboard or configure settings |
| `baton source create <name>` | Scaffold a new source repository |
| `baton source list` | List registered global sources |
| `baton source connect <url>` | Register a source globally |
| `baton source disconnect <name>` | Remove a global source |
| `baton profile create <name>` | Create a new profile in a source repo |
| `baton profile list` | List profiles |
| `baton profile remove <name>` | Remove a profile |
| `baton ai-tools scan` | Detect installed AI tools |
| `baton ai-tools list` | List configured AI tools |
| `baton ides scan` | Detect installed IDE platforms |
| `baton ides list` | List configured IDE platforms |

**Global flags:** `--yes/-y`, `--dry-run`, `--verbose`, `--version/-v`

## Development Commands

```bash
bun run build       # Build all packages (tsdown)
bun run test        # Run tests (vitest)
bun run lint        # Lint with Biome
bun run typecheck   # TypeScript strict check
bun run dead-code   # Find unused exports (knip)
bun run dev         # Run CLI from source (tsx)
```

## Release Workflow

Releases use Changesets + GitHub Actions.

**Local steps only:**
```bash
bun run changeset              # Create a changeset file
git add .changeset/ && git commit && git push
```

**Never run locally:** `changeset version`, `ci:version`, `ci:publish`.

On push to `main`: release workflow detects changeset files, creates a version bump PR, and after merge publishes to npm and updates the Homebrew formula.

## Development Conventions

- **TypeScript strict mode** — no `any` types, use `unknown` + type narrowing
- **Named exports only** — no `export default`
- **Functional composition** — except adapters which use class inheritance (`BaseAIToolAdapter`)
- **Zod schemas as source of truth** — derive types with `z.infer<typeof schema>`
- **Tests co-located** — `foo.test.ts` next to `foo.ts` (vitest)
- **Async file I/O** — always `fs/promises`, never sync
- **Conventional commits** — `feat(cli):`, `fix(core):`, `refactor(ai-tool-paths):`
- **Biome formatting** — run `bun run lint` before committing
- **Import ordering** — Node built-ins → external packages → workspace packages → relative imports
