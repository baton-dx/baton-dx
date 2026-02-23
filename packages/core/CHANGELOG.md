# @baton-dx/core

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
