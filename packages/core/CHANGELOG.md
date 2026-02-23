# @baton-dx/core

## 0.9.0

### Minor Changes

- [#92](https://github.com/baton-dx/baton-dx/pull/92) [`fb5d6f2`](https://github.com/baton-dx/baton-dx/commit/fb5d6f2d4ea03664e2616c00b970755dc7d00de1) Thanks [@mantaray0](https://github.com/mantaray0)! - Add complete NPM source support with caching for sync, diff, and inheritance

  - NPM sources now work in profile inheritance chains (`extends: npm:@scope/package`)
  - `baton sync` resolves NPM sources alongside Git sources
  - `baton diff` compares local files against NPM package contents
  - Persistent NPM package cache in `~/.baton/cache/npm/` for faster repeated operations

### Patch Changes

- Updated dependencies []:
  - @baton-dx/ai-tool-paths@0.9.0

## 0.8.3

### Patch Changes

- Updated dependencies []:
  - @baton-dx/ai-tool-paths@0.8.3

## 0.8.2

### Patch Changes

- [#74](https://github.com/baton-dx/baton-dx/pull/74) [`c5923a4`](https://github.com/baton-dx/baton-dx/commit/c5923a4eb08c19f746c9cbd5ba3453fc99a153ab) Thanks [@mantaray0](https://github.com/mantaray0)! - Stop gitignoring project files (e.g. biome.json, .editorconfig) placed by profiles — they should be committed so the project works without Baton.

- Updated dependencies [[`c5923a4`](https://github.com/baton-dx/baton-dx/commit/c5923a4eb08c19f746c9cbd5ba3453fc99a153ab)]:
  - @baton-dx/ai-tool-paths@0.8.2

## 0.8.1

### Patch Changes

- [#71](https://github.com/baton-dx/baton-dx/pull/71) [`8272e28`](https://github.com/baton-dx/baton-dx/commit/8272e28fa7ba20a835d50dbf2b99a5743b9faf6b) Thanks [@mantaray0](https://github.com/mantaray0)! - Remove unused `merge` field from file config items in profile manifest schema. Files are deduplicated by target path (last-wins by weight), not merged. Merge strategies only apply to memory items.

- Updated dependencies [[`8272e28`](https://github.com/baton-dx/baton-dx/commit/8272e28fa7ba20a835d50dbf2b99a5743b9faf6b)]:
  - @baton-dx/ai-tool-paths@0.8.1

## 0.3.2

### Patch Changes

- [#69](https://github.com/baton-dx/baton-dx/pull/69) [`e81d9a6`](https://github.com/baton-dx/baton-dx/commit/e81d9a6a8c1af45329cb5647d809855cb9a000ab) Thanks [@mantaray0](https://github.com/mantaray0)! - Remove unused `merge` field from file config items in profile manifest schema. Files are deduplicated by target path (last-wins by weight), not merged. Merge strategies only apply to memory items.

## 0.3.1

### Patch Changes

- [#60](https://github.com/baton-dx/baton-dx/pull/60) [`b9369b2`](https://github.com/baton-dx/baton-dx/commit/b9369b2e45b38bb7805f7a001ee2dde789c3af10) Thanks [@mantaray0](https://github.com/mantaray0)! - Fix self-update not actually updating to latest version by adding `--latest` flag for bun/pnpm and using `install @latest` for npm

## 0.3.0

### Minor Changes

- [#56](https://github.com/baton-dx/baton-dx/pull/56) [`51ed347`](https://github.com/baton-dx/baton-dx/commit/51ed347d3d7fac1cca143c31a6e069bbbf309e1e) Thanks [@mantaray0](https://github.com/mantaray0)! - Make lockfile tool-agnostic with canonical keys and add local placement state

  The `baton.lock` now uses canonical paths (e.g., `skills/add-adapter`, `memory/MEMORY.md`) instead of tool-specific paths (e.g., `.claude/skills/add-adapter`). This ensures identical lockfiles regardless of which AI tools each developer has installed.

  Tool-specific file tracking moves to `.baton/state.yaml` (local, gitignored), which is used for orphan detection and cleanup. This two-layer architecture reduces lockfile size by ~85% and eliminates cross-developer conflicts.

## 0.2.1

### Patch Changes

- [#39](https://github.com/baton-dx/baton-dx/pull/39) [`dfedc25`](https://github.com/baton-dx/baton-dx/commit/dfedc25b645d13b533ff74b42a1aba51bb5b7488) Thanks [@mantaray0](https://github.com/mantaray0)! - Remove dead config/cache code: `config list/get/set` subcommands, unused `cache` schema, `invalidateCache()`, and fix misleading `# Baton cache` gitignore comment

## 0.2.0

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

## 0.1.1

### Patch Changes

- Updated dependencies []:
  - @baton-dx/agent-paths@0.1.1
