# @baton-dx/cli

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
