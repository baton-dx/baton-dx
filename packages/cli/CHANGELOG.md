# @baton-dx/cli

## 1.0.5

## 1.0.4

## 1.0.3

## 1.0.2

## 1.0.1

## 1.0.0

### Major Changes

- 886e927: ## Baton 1.0 — Convention-over-Configuration

  Baton 1.0 replaces the manifest-based configuration model with a **convention-over-configuration** approach. Profile content is no longer declared in `baton.profile.yaml` — it is auto-discovered from the filesystem.

  ### Breaking Changes

  **Profile manifests no longer declare content.** The following fields are removed from `baton.profile.yaml`:

  `ai.rules`, `ai.skills`, `ai.agents`, `ai.memory`, `ai.commands`, `ai.mcp`, `files`, `ide`

  Content is now placed in the profile directory by convention:

  ```
  my-profile/
  ├── baton.profile.yaml        # metadata only
  ├── ai/
  │   ├── rules/*.md
  │   ├── agents/*.md
  │   ├── skills/<name>/SKILL.md
  │   ├── commands/*.md
  │   ├── memory/MEMORY.md
  │   └── mcp/*.yaml
  ├── files/
  └── ide/<platform>/
  ```

  **Source manifests no longer declare profiles.** The `profiles` field is removed from `baton.source.yaml`. Profiles are always auto-discovered from the `profiles/` directory.

  **Merge strategies simplified from 8 to 2.** Only `concat` (default) and `replace` are supported. Set via frontmatter:

  ```markdown
  ---
  merge: replace
  ---
  ```

  Removed strategies: `deep`, `append`, `prepend`, `skip`, `prompt`, `directory`, `import`

  **`baton update` command removed.** Use `baton sync` instead.

  ***

  ### New Features

  **`baton preview`** — inspect processed output per AI tool before syncing:

  ```bash
  baton preview --tool claude-code
  baton preview --tool cursor --type rules
  baton preview --tool claude-code --diff cursor
  ```

  **`baton:else` directive:**

  ```markdown
  <!-- baton:if tool="claude-code" -->

  Claude-specific content.

  <!-- baton:else -->

  Content for all other tools.

  <!-- baton:endif -->
  ```

  **Expression-based conditions:**

  ```markdown
  <!-- baton:if condition="tool=='claude-code' AND scope=='project'" -->
  ```

  Supported operators: `AND`, `OR`, `NOT`, parentheses. Condition types: `tool`, `ide`, `scope`, `type`, `file`, `has`, `variable`

  **Code block awareness** — directives inside fenced code blocks are ignored.

  **Explain mode** — `baton preview` shows directive evaluation results for debugging.

  ***

  ### Migration

  See [docs/MIGRATION-1.0.md](https://github.com/baton-dx/baton-dx/blob/main/docs/MIGRATION-1.0.md) for a full upgrade guide.

### Minor Changes

- 85a4df8: feat(cli): add --json output for CI/CD integration + standardize CLI output

  - Global `--json` flag (`-j`) for machine-readable JSON output on all list/scan/sync/apply/diff/config/auth commands
  - Consistent JSON envelope: `{ success, data, warnings, errors }`
  - Migrated all `console.log()` in commands to `@clack/prompts` API
  - Replaced manual ANSI escape codes with `picocolors`
  - Shared table renderer utility (`renderTable`) for list commands
  - Global `--verbose` flag wired through `getOutputContext()` helper

### Patch Changes

- 083dc16: fix(core): lockfile SHA cache lookup by source field instead of mismatched key

  The lockfile SHA cache was never hit because write used profile name as key but read used `getPackageNameFromSource()` (org/repo). Replaced key-based lookup with `findLockedPackageBySource()` that scans by the `source` field, which is consistent between write and read paths.

- 22ec59e: fix(cli): `baton preview` now correctly shows resolution errors and resolves paths for extended profiles

  - Resolution errors are collected and displayed via `p.log.error()` after the spinner stops, instead of being silently lost via `spinner.message()`
  - Extended profiles in a chain now get their own correct `localPath` instead of inheriting the root profile's path

- dcba8d1: fix(core): strip `@project/` prefix from rendered output in link and reference include modes

  `<!-- baton:include src="@project/README.md" mode="reference" -->` now correctly renders as `See @README.md for additional context.` instead of `See @@project/README.md for additional context.`. Same fix applied to link mode output.

- 7c8e094: fix(core): resolve "latest" to HEAD instead of newest semver tag

  `resolveVersion("latest")` previously preferred the highest semver tag, so
  untagged commits on main were missed during sync. Now "latest" always resolves
  to HEAD of the default branch. Semver matching only applies to explicit version
  specs (e.g., `version: ^1.0.0`).

  Also removes `checkRemoteSha` — sync now compares `resolveVersion` output
  directly against the locked SHA, reducing ls-remote calls from two to one.

- c16411e: fix(core): disable sparse-checkout when refreshing cache without subpath

  When `baton init` (or any full-repo clone) hit a cache entry that was previously
  populated by a subpath-scoped `baton sync`, Git's `reset --hard` only restored
  files within the sparse-checkout cone — leaving all other profile directories
  absent. Profile discovery would then find only 1 profile instead of all 4.

  Added an `isSparseCheckout` helper and call `git sparse-checkout disable` before
  `reset --hard` / `pull` in all three cache-refresh paths when no `subpath` is
  requested, so the full working tree is always restored.

- b1bc1ab: Fix content duplication when multiple adapters share the same target path, dry-run falsely reporting all files as orphans, and apply.ts not stripping Baton frontmatter
- 56d2afd: perf(cli): parallel source fetching with incremental sync

  - Sources are now resolved in parallel with configurable concurrency (`--concurrency N`, default: 5)
  - Incremental sync: `baton sync` compares remote SHA with lockfile to skip unchanged sources
  - Discovery and intersection computation parallelized
  - New `resolveSourcesBatch()` API in `@baton-dx/core`

- 371dd40: fix(cli): show current config state in scan commands

  `ai-tools scan` and `ides scan` now display state-aware labels (`detected`, `saved`, `saved, not detected`) in the interactive multiselect and warn about configured tools/IDEs that were not detected on the system. This helps users understand what will change before confirming, without altering the default pre-selection (still detection-only).

- 6ea4da3: fix(core): support `~/` home-relative paths in local sources

  `parseSource()` now accepts `~/…` paths (e.g. `~/Sites/baton/test-v1`) as valid local sources. Previously these threw a `SourceParseError` and were stored raw in `baton.yaml`, causing all subsequent commands to fail.

  A new `expandLocalPath(path, baseDir)` helper replaces all path-resolution spots across `sync`, `apply`, `init`, `manage`, `diff`, `preview`, `source connect`, and internal utilities so that `~/`, `/`, `./`, and `../` paths all resolve correctly.

  `baton source connect` additionally normalises `./`/`../` paths to absolute before storing, so the saved URL is never cwd-dependent.

## 1.0.0-alpha.13

### Patch Changes

- 7c8e094: fix(core): resolve "latest" to HEAD instead of newest semver tag

  `resolveVersion("latest")` previously preferred the highest semver tag, so
  untagged commits on main were missed during sync. Now "latest" always resolves
  to HEAD of the default branch. Semver matching only applies to explicit version
  specs (e.g., `version: ^1.0.0`).

  Also removes `checkRemoteSha` — sync now compares `resolveVersion` output
  directly against the locked SHA, reducing ls-remote calls from two to one.

## 1.0.0-alpha.12

### Patch Changes

- 083dc16: fix(core): lockfile SHA cache lookup by source field instead of mismatched key

  The lockfile SHA cache was never hit because write used profile name as key but read used `getPackageNameFromSource()` (org/repo). Replaced key-based lookup with `findLockedPackageBySource()` that scans by the `source` field, which is consistent between write and read paths.

## 1.0.0-alpha.11

### Patch Changes

- 56d2afd: perf(cli): parallel source fetching with incremental sync

  - Sources are now resolved in parallel with configurable concurrency (`--concurrency N`, default: 5)
  - Incremental sync: `baton sync` compares remote SHA with lockfile to skip unchanged sources
  - Discovery and intersection computation parallelized
  - New `resolveSourcesBatch()` API in `@baton-dx/core`

## 1.0.0-alpha.10

### Minor Changes

- 85a4df8: feat(cli): add --json output for CI/CD integration + standardize CLI output

  - Global `--json` flag (`-j`) for machine-readable JSON output on all list/scan/sync/apply/diff/config/auth commands
  - Consistent JSON envelope: `{ success, data, warnings, errors }`
  - Migrated all `console.log()` in commands to `@clack/prompts` API
  - Replaced manual ANSI escape codes with `picocolors`
  - Shared table renderer utility (`renderTable`) for list commands
  - Global `--verbose` flag wired through `getOutputContext()` helper

## 1.0.0-alpha.9

## 1.0.0-alpha.8

### Patch Changes

- b1bc1ab: Fix content duplication when multiple adapters share the same target path, dry-run falsely reporting all files as orphans, and apply.ts not stripping Baton frontmatter

## 1.0.0-alpha.7

### Patch Changes

- dcba8d1: fix(core): strip `@project/` prefix from rendered output in link and reference include modes

  `<!-- baton:include src="@project/README.md" mode="reference" -->` now correctly renders as `See @README.md for additional context.` instead of `See @@project/README.md for additional context.`. Same fix applied to link mode output.

## 1.0.0-alpha.6

### Patch Changes

- b1bc1ab: Fix content duplication when multiple adapters share the same target path, dry-run falsely reporting all files as orphans, and apply.ts not stripping Baton frontmatter

## 1.0.0-alpha.5

### Patch Changes

- 22ec59e: fix(cli): `baton preview` now correctly shows resolution errors and resolves paths for extended profiles

  - Resolution errors are collected and displayed via `p.log.error()` after the spinner stops, instead of being silently lost via `spinner.message()`
  - Extended profiles in a chain now get their own correct `localPath` instead of inheriting the root profile's path

## 1.0.0-alpha.4

### Patch Changes

- 371dd40: fix(cli): show current config state in scan commands

  `ai-tools scan` and `ides scan` now display state-aware labels (`detected`, `saved`, `saved, not detected`) in the interactive multiselect and warn about configured tools/IDEs that were not detected on the system. This helps users understand what will change before confirming, without altering the default pre-selection (still detection-only).

## 1.0.0-alpha.3

### Patch Changes

- 6ea4da3: fix(core): support `~/` home-relative paths in local sources

  `parseSource()` now accepts `~/…` paths (e.g. `~/Sites/baton/test-v1`) as valid local sources. Previously these threw a `SourceParseError` and were stored raw in `baton.yaml`, causing all subsequent commands to fail.

  A new `expandLocalPath(path, baseDir)` helper replaces all path-resolution spots across `sync`, `apply`, `init`, `manage`, `diff`, `preview`, `source connect`, and internal utilities so that `~/`, `/`, `./`, and `../` paths all resolve correctly.

  `baton source connect` additionally normalises `./`/`../` paths to absolute before storing, so the saved URL is never cwd-dependent.

## 1.0.0-alpha.2

### Patch Changes

- c16411e: fix(core): disable sparse-checkout when refreshing cache without subpath

  When `baton init` (or any full-repo clone) hit a cache entry that was previously
  populated by a subpath-scoped `baton sync`, Git's `reset --hard` only restored
  files within the sparse-checkout cone — leaving all other profile directories
  absent. Profile discovery would then find only 1 profile instead of all 4.

  Added an `isSparseCheckout` helper and call `git sparse-checkout disable` before
  `reset --hard` / `pull` in all three cache-refresh paths when no `subpath` is
  requested, so the full working tree is always restored.
