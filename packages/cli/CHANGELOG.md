# @baton-dx/cli

## 0.14.1

### Patch Changes

- [#129](https://github.com/baton-dx/baton-dx/pull/129) [`379f26a`](https://github.com/baton-dx/baton-dx/commit/379f26ad709bafc45d8f6f7144d5f812665bb341) Thanks [@mantaray0](https://github.com/mantaray0)! - Track Baton CLI version in lockfile and warn on downgrade

  `baton.lock` now records a `baton_version` field (the CLI version that ran `sync` or `apply`).
  When a developer runs `baton sync` or `baton apply` with an older Baton version than the one that
  generated the lockfile, a warning is shown and an interactive update prompt is offered.

  - Old lockfiles without `baton_version` are silently accepted (backward-compatible).
  - Newer Baton reading an older lockfile produces no warning.
  - `checkLockfileVersion(lockfile, currentVersion)` exported from `@baton-dx/core`.

## 0.14.0

### Minor Changes

- [#126](https://github.com/baton-dx/baton-dx/pull/126) [`7c51ac2`](https://github.com/baton-dx/baton-dx/commit/7c51ac2f392d1ed6aac8d6d42c30e4039ad1cfd2) Thanks [@mantaray0](https://github.com/mantaray0)! - feat: MCP server distribution support (Issue #80)

  Define MCP servers once in `ai.mcp[]` inside `baton.profile.yaml` — Baton places them into each tool's native config format during `baton sync`.

  **New profile syntax:**

  ```yaml
  ai:
    mcp:
      - name: filesystem
        transport: stdio
        command: npx
        args: ["-y", "@modelcontextprotocol/server-filesystem"]
        env:
          ROOT_DIR: "${HOME}"
        scope: project
      - name: github
        transport: http
        url: https://api.githubcopilot.com/mcp/
        scope: global
  ```

  **Supported across all 13 tools** (Junie excluded — no MCP support):

  - Dedicated JSON files: Claude Code, Cursor, Kiro, Roo, Amp, GitHub Copilot, Trae, OpenCode (JSONC)
  - Shared settings files (read-modify-write): Zed (`settings.json`), Cline, Antigravity, Codex CLI (TOML)

  **Env-var transformation:** `${VAR}` syntax in `env` fields is transformed to each tool's native syntax at sync time.

  **State tracking:** Previously placed MCP servers are tracked in `.baton/state.yaml` so stale servers are removed on the next sync.

## 0.13.1

## 0.13.0

### Minor Changes

- [#120](https://github.com/baton-dx/baton-dx/pull/120) [`3a921e0`](https://github.com/baton-dx/baton-dx/commit/3a921e039d6fcd2eca8db2e523597fa320c6dca5) Thanks [@mantaray0](https://github.com/mantaray0)! - Add sync robustness features: `--check` flag, sync report, profile hooks, and atomic writes.

  - **`baton sync --check`**: Read-only stale detection — exits 0 if configs are in sync, 1 if stale. Safe for CI pre-merge checks and Git pre-commit hooks.
  - **Sync report**: `--verbose` now outputs a granular per-file summary (created / updated / skipped / removed) in the sync/apply outro.
  - **Profile hooks**: `post-install` and `post-update` hooks defined in `baton.profile.yaml` are now executed after file placement.
  - **Atomic writes**: All Baton-managed file writes use write-to-temp-then-rename to prevent partial writes on crash or interrupt.

## 0.12.1

### Patch Changes

- [#117](https://github.com/baton-dx/baton-dx/pull/117) [`c6aac66`](https://github.com/baton-dx/baton-dx/commit/c6aac66860c3bc84067f1139b55032fcc1112cfa) Thanks [@mantaray0](https://github.com/mantaray0)! - fix(cli): remove false-positive orphan detection from lockfile fallback

  After upgrading from an older state.yaml format, users were seeing up to 39
  false-positive "orphaned files" on the next `baton sync`. Confirming removal
  had no effect (0 files removed) because the lockfile stores canonical paths
  (e.g. `skills/code-review`) — not tool-specific disk paths.

  `loadPreviousPlacedPaths` now reads exclusively from `.baton/state.yaml`.
  When state.yaml is absent or fails schema validation, an empty set is returned,
  skipping orphan detection entirely. This is correct: no previous state means
  no known previously-placed files to compare against.

## 0.12.0

### Minor Changes

- [#113](https://github.com/baton-dx/baton-dx/pull/113) [`67a2c30`](https://github.com/baton-dx/baton-dx/commit/67a2c30e4f7a855ac147c6e3d1bfc4c31df721cf) Thanks [@mantaray0](https://github.com/mantaray0)! - feat: granular gitignore categories, categorized state.yaml, and remove-baton fixes

  - Add granular `gitignore` config: `{ ai-tools, ides, files }` object form alongside existing boolean (backward-compatible)
  - `.gitignore` managed block now uses `## category` section headers for ai-tools, ides, and files
  - `state.yaml` `placed_files` is now categorized by type (`ai-tools`, `ides`, `files`) instead of a flat array
  - `baton manage → Configure .gitignore` immediately applies changes to `.gitignore` (no sync required)
  - `baton manage → Remove Baton` now also removes the `.baton/` directory
  - `baton init` uses multiselect for gitignore categories (ai-tools ✓, ides ✓, files ✗ default)
  - Add `parseGitignoreConfig`, `collectAiToolPatterns`, `collectIdePatterns`, `collectFilePatterns`, `updateGitignoreWithSections`, `flattenPlacedFiles` to core exports

## 0.11.0

### Minor Changes

- [#111](https://github.com/baton-dx/baton-dx/pull/111) [`cbd3148`](https://github.com/baton-dx/baton-dx/commit/cbd314843a981628dbcf6c84c65d94c902edcd5c) Thanks [@mantaray0](https://github.com/mantaray0)! - Fix memory deduplication for diamond inheritance and add unified "Manage profiles" flow.

  - **fix(core):** Memory contributions are now deduplicated when the same base profile appears multiple times via diamond inheritance (e.g., `react extends base` + `vue extends base`). Skills/rules were unaffected due to Map-based dedup.
  - **feat(cli):** Replace separate "Add profile" / "Remove profile" menu items in `baton manage` with a single "Manage profiles" entry. Shows all available profiles as a cascading multiselect with pre-selected installed profiles. Supports adding and removing profiles in one step.
  - **feat(cli):** Add `initialValues` support to cascading multiselect for pre-selecting profiles.

## 0.10.1

## 0.10.0

### Minor Changes

- [#104](https://github.com/baton-dx/baton-dx/pull/104) [`5255c46`](https://github.com/baton-dx/baton-dx/commit/5255c46217890e7c8daf5c0168fa49664ea36b4e) Thanks [@mantaray0](https://github.com/mantaray0)! - Simplify `extends` to single string, add profile hierarchy tree, upgrade Biome to v2

  **Breaking:** `extends` in `baton.profile.yaml` now accepts a single profile name (string) instead of an array. Update `extends: [base]` to `extends: base`.

  **feat(core):**

  - `extends` simplified from `string[]` to `string` — one parent per profile, resolved as sibling directory
  - Profile chain cycle detection and maximum-depth enforcement updated accordingly
  - Validation Check 13: verifies sibling profile exists when `extends` is set
  - Validation Check 16: detects extend loops (direct and indirect) across the source
  - Validation Check 17: warns when sibling profiles share the same weight

  **feat(cli):**

  - `baton profile list` now shows a hierarchy tree (parent → child) above the table
  - Profile table includes `Weight` and `Extends` columns
  - `baton manage` add-profile upgraded to multi-select (install multiple profiles at once)
  - `baton manage` overview shows `weight` and `inherits` metadata per installed profile, with same-weight conflict warnings

  **chore:** Biome upgraded from 1.x to 2.x; `organizeImports` migrated to `assist.actions.source`

## 0.9.2

### Patch Changes

- [#101](https://github.com/baton-dx/baton-dx/pull/101) [`f802c45`](https://github.com/baton-dx/baton-dx/commit/f802c45f5c60318160c6d058fb7d455dac0a717b) Thanks [@mantaray0](https://github.com/mantaray0)! - Fix profile name validation to allow digit-prefixed names (e.g., "3d"), fix sparse-checkout cache corruption when multiple profiles share the same git source, and suppress false memory weight-conflict warnings when profiles use identical merge strategies.

## 0.9.1

### Patch Changes

- [#96](https://github.com/baton-dx/baton-dx/pull/96) [`d0711a2`](https://github.com/baton-dx/baton-dx/commit/d0711a2777a737d06b7e891e4de495de612e3e97) Thanks [@mantaray0](https://github.com/mantaray0)! - Add scope system for all config types

  - Add `resolveScope()` helper with 3-tier cascade: item → profile → "project" default
  - Support optional `scope` field on profile manifest, rules, agents, memory, and skills
  - Replace hardcoded "project" scope in sync, apply, and diff commands
  - Backward-compatible: existing profiles without scope continue to default to "project"

## 0.9.0

### Patch Changes

- [#92](https://github.com/baton-dx/baton-dx/pull/92) [`fb5d6f2`](https://github.com/baton-dx/baton-dx/commit/fb5d6f2d4ea03664e2616c00b970755dc7d00de1) Thanks [@mantaray0](https://github.com/mantaray0)! - Add complete NPM source support with caching for sync, diff, and inheritance

  - NPM sources now work in profile inheritance chains (`extends: npm:@scope/package`)
  - `baton sync` resolves NPM sources alongside Git sources
  - `baton diff` compares local files against NPM package contents
  - Persistent NPM package cache in `~/.baton/cache/npm/` for faster repeated operations

## 0.8.3

### Patch Changes

- [#76](https://github.com/baton-dx/baton-dx/pull/76) [`a8444b9`](https://github.com/baton-dx/baton-dx/commit/a8444b9deff15407c666aca729227ec6c3a77d9c) Thanks [@mantaray0](https://github.com/mantaray0)! - Always fetch fresh sources in interactive profile selection, init, and intersection display so newly added profiles are immediately visible.

## 0.8.2

### Patch Changes

- [#74](https://github.com/baton-dx/baton-dx/pull/74) [`c5923a4`](https://github.com/baton-dx/baton-dx/commit/c5923a4eb08c19f746c9cbd5ba3453fc99a153ab) Thanks [@mantaray0](https://github.com/mantaray0)! - Stop gitignoring project files (e.g. biome.json, .editorconfig) placed by profiles — they should be committed so the project works without Baton.

## 0.8.1

### Patch Changes

- [#71](https://github.com/baton-dx/baton-dx/pull/71) [`8272e28`](https://github.com/baton-dx/baton-dx/commit/8272e28fa7ba20a835d50dbf2b99a5743b9faf6b) Thanks [@mantaray0](https://github.com/mantaray0)! - Remove unused `merge` field from file config items in profile manifest schema. Files are deduplicated by target path (last-wins by weight), not merged. Merge strategies only apply to memory items.

## 0.8.0

### Minor Changes

- [#65](https://github.com/baton-dx/baton-dx/pull/65) [`c0f5986`](https://github.com/baton-dx/baton-dx/commit/c0f59869bd4305d41bc58da31c17500438df9448) Thanks [@mantaray0](https://github.com/mantaray0)! - Add `baton source validate` command that validates source repository structure and manifests with 15 checks covering schema validation, file references, variable consistency, and orphaned profile detection

## 0.7.1

### Patch Changes

- [#62](https://github.com/baton-dx/baton-dx/pull/62) [`fde299a`](https://github.com/baton-dx/baton-dx/commit/fde299ab6b786242c377463f21102b14d6fe5e79) Thanks [@mantaray0](https://github.com/mantaray0)! - Release CLI with self-update fix that adds --latest flag for bun/pnpm and uses install @latest for npm

## 0.7.0

### Minor Changes

- [#56](https://github.com/baton-dx/baton-dx/pull/56) [`51ed347`](https://github.com/baton-dx/baton-dx/commit/51ed347d3d7fac1cca143c31a6e069bbbf309e1e) Thanks [@mantaray0](https://github.com/mantaray0)! - Make lockfile tool-agnostic with canonical keys and add local placement state

  The `baton.lock` now uses canonical paths (e.g., `skills/add-adapter`, `memory/MEMORY.md`) instead of tool-specific paths (e.g., `.claude/skills/add-adapter`). This ensures identical lockfiles regardless of which AI tools each developer has installed.

  Tool-specific file tracking moves to `.baton/state.yaml` (local, gitignored), which is used for orphan detection and cleanup. This two-layer architecture reduces lockfile size by ~85% and eliminates cross-developer conflicts.

## 0.6.1

### Patch Changes

- [#54](https://github.com/baton-dx/baton-dx/pull/54) [`6860d6a`](https://github.com/baton-dx/baton-dx/commit/6860d6a0912b93e7d9d92e28a4b78ffd0b2de672) Thanks [@mantaray0](https://github.com/mantaray0)! - Default sync prompt to "No" when connecting a new source to prevent accidental global profile sync

## 0.6.0

### Minor Changes

- [#51](https://github.com/baton-dx/baton-dx/pull/51) [`52a00fe`](https://github.com/baton-dx/baton-dx/commit/52a00fe02c1fcdded95f6123c365b2cb6d7ab03a) Thanks [@mantaray0](https://github.com/mantaray0)! - feat: add `baton self-update` command for updating Baton to the latest stable version. Auto-detects installation method (npm, pnpm, bun, Homebrew) and runs the appropriate update command.

## 0.5.0

### Minor Changes

- [#48](https://github.com/baton-dx/baton-dx/pull/48) [`be45cf8`](https://github.com/baton-dx/baton-dx/commit/be45cf8ea8fdd3f2b4067050791bfe5cf61e6025) Thanks [@mantaray0](https://github.com/mantaray0)! - Restructure CLI commands: add `baton apply` for deterministic lock-based sync, change `baton sync` to always fetch latest versions, deprecate `baton update`

  - `baton apply` — applies locked configurations from `baton.lock` (deterministic, reproducible)
  - `baton sync` — fetches latest versions, places files, and updates lockfile
  - `baton update` — deprecated, delegates to `baton sync` with a warning
  - `baton.lock` is no longer added to `.gitignore` — commit it for reproducible team builds

## 0.4.4

### Patch Changes

- [#45](https://github.com/baton-dx/baton-dx/pull/45) [`ec2eb60`](https://github.com/baton-dx/baton-dx/commit/ec2eb604c53886384ec700db40fa009957792455) Thanks [@mantaray0](https://github.com/mantaray0)! - Fix git clone failing when source version is a commit SHA

  `git clone --branch` only accepts branch/tag names, not commit SHAs. When the lockfile or `baton update` resolves a version to a commit SHA, cloning now correctly fetches the specific commit instead of passing it as `--branch`.

## 0.4.3

### Patch Changes

- [#42](https://github.com/baton-dx/baton-dx/pull/42) [`8e8be6c`](https://github.com/baton-dx/baton-dx/commit/8e8be6cd0350e0df873a9aa19d81f8412793a5e7) Thanks [@mantaray0](https://github.com/mantaray0)! - Fix profile extends resolution, source freshness, and profile discovery

  - Fix sparse-checkout expansion for `extends` chains: parent profiles referenced via `extends` in remote sources are now correctly loaded by expanding the git sparse-checkout on demand
  - Replace silent error swallowing with hard errors when an `extends` target cannot be resolved
  - Add automatic source cache freshness check with configurable TTL (default: 24 hours)
  - Add `--fresh` flag to `baton sync` to force immediate source refresh
  - Add `baton config set` subcommand for programmatic config changes (e.g., `baton config set sync.cacheTtlHours 1`)
  - Fix profile discovery in `baton init` and `baton manage` to show all available profiles instead of only "base"

## 0.4.2

### Patch Changes

- [#39](https://github.com/baton-dx/baton-dx/pull/39) [`dfedc25`](https://github.com/baton-dx/baton-dx/commit/dfedc25b645d13b533ff74b42a1aba51bb5b7488) Thanks [@mantaray0](https://github.com/mantaray0)! - Remove dead config/cache code: `config list/get/set` subcommands, unused `cache` schema, `invalidateCache()`, and fix misleading `# Baton cache` gitignore comment

## 0.4.1

### Patch Changes

- [#36](https://github.com/baton-dx/baton-dx/pull/36) [`1f687a6`](https://github.com/baton-dx/baton-dx/commit/1f687a6af361eaef55ada74160bdf28483836bfc) Thanks [@mantaray0](https://github.com/mantaray0)! - Remove dead `config list/get/set` subcommands and fix misleading help text in `ai-tools list`

## 0.4.0

### Minor Changes

- [#33](https://github.com/baton-dx/baton-dx/pull/33) [`fe38dba`](https://github.com/baton-dx/baton-dx/commit/fe38dba6aae090901f51fa4edaf5a369b7353895) Thanks [@mantaray0](https://github.com/mantaray0)! - Remove `settings` ConfigType — tool-specific settings files should use the generic `files` structure with `source`/`target` instead. Also removes unused `lockfile/index.ts` barrel export and orphaned `execa` dependency.

## 0.3.2

### Patch Changes

- [#30](https://github.com/baton-dx/baton-dx/pull/30) [`66c9ad1`](https://github.com/baton-dx/baton-dx/commit/66c9ad1be416a68286ac02c8433d550b19bb3c38) Thanks [@mantaray0](https://github.com/mantaray0)! - Make .gitignore a project-level decision at init time instead of per-sync dynamic updates. Adds `gitignore` field to baton.yaml, comprehensive patterns for all known AI tools and IDE platforms, and fixes a bug where `.github/` was over-broadly gitignored instead of only `.github/copilot-instructions.md`.

## 0.3.1

### Patch Changes

- [#23](https://github.com/baton-dx/baton-dx/pull/23) [`971b842`](https://github.com/baton-dx/baton-dx/commit/971b8429001c86d924c30ddac245dcc7e9196854) Thanks [@mantaray0](https://github.com/mantaray0)! - Extract reusable placed-file cleanup to core

  - Add `removePlacedFiles()` to `@baton-dx/core` for cleaning up lockfile-tracked placed files
  - Refactor `baton sync` cleanup to use the shared function
  - Wire placed-file cleanup into the "Remove Baton" flow in `baton manage`
  - Normalize lockfile paths to relative, fixing an EISDIR bug when removing directories

## 0.3.0

### Minor Changes

- [#18](https://github.com/baton-dx/baton-dx/pull/18) [`1a9e1f5`](https://github.com/baton-dx/baton-dx/commit/1a9e1f59c4a1fae0a7f020dc0f43f43e32f1f541) Thanks [@mantaray0](https://github.com/mantaray0)! - feat: developer tool & IDE selection

  Allow developers to choose which AI tools and IDEs Baton configures, both globally and per-project.

  - Add project preferences (.baton/preferences.yaml) with resolution chain: project overrides > global config
  - Enhanced multiselect in `baton ai-tools scan` and `baton ides scan` (choose which detected tools to save)
  - New `baton ai-tools configure` and `baton ides configure` commands with `--project` flag
  - First-run preferences prompt in `baton init` and `baton sync`
  - Project preference options in `baton manage` wizard
  - Source attribution in `baton config` dashboard (shows "from global config" or "from project preferences")
  - Auto-gitignore .baton/preferences.yaml

## 0.2.0

### Minor Changes

- [#15](https://github.com/baton-dx/baton-dx/pull/15) [`f41504d`](https://github.com/baton-dx/baton-dx/commit/f41504d7555728f13b20f4f70824c752cbb8260d) Thanks [@mantaray0](https://github.com/mantaray0)! - Redesign detection system for AI tools and IDEs to eliminate false positives

  - Replace flat OR-based detection with structured DetectionConfig using OR-of-ANDs evaluation logic
  - Add 5 detection mechanisms: binary (with version verification), directory (with marker files), macOS app bundles, VS Code extensions, JetBrains plugins
  - Fix false positives: GitHub Copilot no longer detected from `gh` CLI, leftover directories no longer trigger detection without marker files, binary name collisions prevented via version pattern matching
  - Add cross-platform support for binary lookup (`which` on Unix, `where` on Windows)
  - Populate detection configs for all 14 AI tools and 6 IDE platforms
  - Remove legacy `detection: string[]` field in favor of typed `detectionConfig`
  - Consolidate shared detection helpers into single `mechanisms.ts` module

## 0.1.5

### Patch Changes

- [#13](https://github.com/baton-dx/baton-dx/pull/13) [`cce3c61`](https://github.com/baton-dx/baton-dx/commit/cce3c61c986d3c8e33b7419eddb4f1505ad946d7) Thanks [@mantaray0](https://github.com/mantaray0)! - Fix profile inheritance (extends) not working during sync — parent profile content (memory, rules, skills, files, commands) was silently skipped because inherited profiles were not registered in the local path map

## 0.1.4

### Patch Changes

- [#10](https://github.com/baton-dx/baton-dx/pull/10) [`de49425`](https://github.com/baton-dx/baton-dx/commit/de49425d690b3a496d4dd4202bd30d130799158e) Thanks [@mantaray0](https://github.com/mantaray0)! - Add explicit `permissions: contents: read` to CI workflow to satisfy GitHub security audit (least-privilege principle)

- [#8](https://github.com/baton-dx/baton-dx/pull/8) [`50b6f1d`](https://github.com/baton-dx/baton-dx/commit/50b6f1d77293997c943b3b2c2297a6064374a5e1) Thanks [@mantaray0](https://github.com/mantaray0)! - Fix template path resolution in bundled CLI for `source create` and `profile create` commands

  Both commands referenced templates via `src/templates/` which doesn't exist in the published package. Templates are copied to `dist/templates/` by tsdown's `copy` config, so paths now resolve relative to `__dirname` (the `dist/` directory) instead of navigating up to a non-existent `src/` directory.

## 0.1.3

### Patch Changes

- [`97e9e8f`](https://github.com/baton-dx/baton-dx/commit/97e9e8f4d4b21b8f7f2b52374d4dcd64d97420a3) Thanks [@mantaray0](https://github.com/mantaray0)! - Include root README.md in published npm package via prepack script.

## 0.1.2

### Patch Changes

- [`dcc30a9`](https://github.com/baton-dx/baton-dx/commit/dcc30a9a87e2ef98144dc467f254d3c0ed766cb5) Thanks [@mantaray0](https://github.com/mantaray0)! - Bundle all workspace dependencies into CLI build for zero-dependency install. `core` and `agent-paths` are now private packages bundled via tsdown aliases. Adds `btx` as a short CLI alias.

## 0.1.1

### Patch Changes

- Fix install commands to use correct scoped package name (`@baton-dx/cli` instead of `baton-dx`) and add `btx` as a short CLI alias alongside `baton` and `baton-dx`.

- Updated dependencies []:
  - @baton-dx/agent-paths@0.1.1
  - @baton-dx/core@0.1.1
