# @baton-dx/cli

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
