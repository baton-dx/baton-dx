# @baton-dx/cli

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
