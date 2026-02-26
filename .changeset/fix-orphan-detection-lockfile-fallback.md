---
"@baton-dx/cli": patch
---

fix(cli): remove false-positive orphan detection from lockfile fallback

After upgrading from an older state.yaml format, users were seeing up to 39
false-positive "orphaned files" on the next `baton sync`. Confirming removal
had no effect (0 files removed) because the lockfile stores canonical paths
(e.g. `skills/code-review`) — not tool-specific disk paths.

`loadPreviousPlacedPaths` now reads exclusively from `.baton/state.yaml`.
When state.yaml is absent or fails schema validation, an empty set is returned,
skipping orphan detection entirely. This is correct: no previous state means
no known previously-placed files to compare against.
