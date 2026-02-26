---
"@baton-dx/cli": minor
"@baton-dx/core": minor
---

Add sync robustness features: `--check` flag, sync report, profile hooks, and atomic writes.

- **`baton sync --check`**: Read-only stale detection — exits 0 if configs are in sync, 1 if stale. Safe for CI pre-merge checks and Git pre-commit hooks.
- **Sync report**: `--verbose` now outputs a granular per-file summary (created / updated / skipped / removed) in the sync/apply outro.
- **Profile hooks**: `post-install` and `post-update` hooks defined in `baton.profile.yaml` are now executed after file placement.
- **Atomic writes**: All Baton-managed file writes use write-to-temp-then-rename to prevent partial writes on crash or interrupt.
