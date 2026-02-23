# @baton-dx/cli

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
