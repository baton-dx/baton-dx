# @baton-dx/core

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

### Patch Changes

- Updated dependencies [[`7c51ac2`](https://github.com/baton-dx/baton-dx/commit/7c51ac2f392d1ed6aac8d6d42c30e4039ad1cfd2)]:
  - @baton-dx/ai-tool-paths@0.14.0

## 0.13.1

### Patch Changes

- [#123](https://github.com/baton-dx/baton-dx/pull/123) [`f21568a`](https://github.com/baton-dx/baton-dx/commit/f21568a09f7d21240a841e1f92c10407d2f421c3) Thanks [@mantaray0](https://github.com/mantaray0)! - fix: lockfile stores logical source reference for `extends`-derived profiles

  Previously, when a remote profile (e.g. `github:org/repo/profiles/maintainer`) used `extends`
  to reference a sibling profile, the sibling's `source` and `resolved` fields in `baton.lock`
  were set to the user-specific local cache path (e.g. `/Users/name/.baton/cache/.../profiles/base`).
  This caused the lockfile to contain machine-specific absolute paths that should not be committed.

  The fix threads a `logicalSource` value separately from the cycle-detection key through
  `resolveChainRecursive`. For extends-derived siblings, the logical source is derived by replacing
  the last path segment of the parent's logical source with the sibling name:

  ```
  github:baton-dx/baton-dx-source/profiles/maintainer  +  extends: base
    → github:baton-dx/baton-dx-source/profiles/base
  ```

  The lockfile now correctly stores portable, machine-independent references for all profiles.

- Updated dependencies []:
  - @baton-dx/ai-tool-paths@0.13.1

## 0.13.0

### Minor Changes

- [#120](https://github.com/baton-dx/baton-dx/pull/120) [`3a921e0`](https://github.com/baton-dx/baton-dx/commit/3a921e039d6fcd2eca8db2e523597fa320c6dca5) Thanks [@mantaray0](https://github.com/mantaray0)! - Add sync robustness features: `--check` flag, sync report, profile hooks, and atomic writes.

  - **`baton sync --check`**: Read-only stale detection — exits 0 if configs are in sync, 1 if stale. Safe for CI pre-merge checks and Git pre-commit hooks.
  - **Sync report**: `--verbose` now outputs a granular per-file summary (created / updated / skipped / removed) in the sync/apply outro.
  - **Profile hooks**: `post-install` and `post-update` hooks defined in `baton.profile.yaml` are now executed after file placement.
  - **Atomic writes**: All Baton-managed file writes use write-to-temp-then-rename to prevent partial writes on crash or interrupt.

### Patch Changes

- Updated dependencies []:
  - @baton-dx/ai-tool-paths@0.13.0

## 0.12.1

### Patch Changes

- Updated dependencies []:
  - @baton-dx/ai-tool-paths@0.12.1

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

### Patch Changes

- Updated dependencies []:
  - @baton-dx/ai-tool-paths@0.12.0

## 0.11.0

### Patch Changes

- Updated dependencies []:
  - @baton-dx/ai-tool-paths@0.11.0

## 0.10.1

### Patch Changes

- [#107](https://github.com/baton-dx/baton-dx/pull/107) [`bb4bcd9`](https://github.com/baton-dx/baton-dx/commit/bb4bcd9c4c0730cf8bedde8cd9d89b0d5c5540c4) Thanks [@mantaray0](https://github.com/mantaray0)! - fix(core): resolve extends sibling path for GitHub/npm/git sources

  `resolveProfileChain` passed `localPath: undefined` for non-local sources (github, gitlab, npm, git), causing `resolveExtendsToPath` to return the raw profile name (e.g. `"react"`) instead of the resolved sibling path. This triggered `Invalid source format: "react"` when syncing a profile with `extends`.

  For non-local providers, callers always pass the cloned profile directory as `baseDir` (i.e. `dirname(manifestPath)`), so it is now used directly as `initialLocalPath`. Error messages now show the original `extends` name instead of the resolved internal path.

- Updated dependencies []:
  - @baton-dx/ai-tool-paths@0.10.1

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

### Patch Changes

- Updated dependencies []:
  - @baton-dx/ai-tool-paths@0.10.0

## 0.9.2

### Patch Changes

- [#101](https://github.com/baton-dx/baton-dx/pull/101) [`f802c45`](https://github.com/baton-dx/baton-dx/commit/f802c45f5c60318160c6d058fb7d455dac0a717b) Thanks [@mantaray0](https://github.com/mantaray0)! - Fix profile name validation to allow digit-prefixed names (e.g., "3d"), fix sparse-checkout cache corruption when multiple profiles share the same git source, and suppress false memory weight-conflict warnings when profiles use identical merge strategies.

- Updated dependencies []:
  - @baton-dx/ai-tool-paths@0.9.2

## 0.9.1

### Patch Changes

- [#96](https://github.com/baton-dx/baton-dx/pull/96) [`d0711a2`](https://github.com/baton-dx/baton-dx/commit/d0711a2777a737d06b7e891e4de495de612e3e97) Thanks [@mantaray0](https://github.com/mantaray0)! - Add scope system for all config types

  - Add `resolveScope()` helper with 3-tier cascade: item → profile → "project" default
  - Support optional `scope` field on profile manifest, rules, agents, memory, and skills
  - Replace hardcoded "project" scope in sync, apply, and diff commands
  - Backward-compatible: existing profiles without scope continue to default to "project"

- Updated dependencies []:
  - @baton-dx/ai-tool-paths@0.9.1

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
