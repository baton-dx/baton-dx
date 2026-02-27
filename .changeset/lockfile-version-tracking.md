---
"@baton-dx/cli": patch
"@baton-dx/core": patch
---

Track Baton CLI version in lockfile and warn on downgrade

`baton.lock` now records a `baton_version` field (the CLI version that ran `sync` or `apply`).
When a developer runs `baton sync` or `baton apply` with an older Baton version than the one that
generated the lockfile, a warning is shown and an interactive update prompt is offered.

- Old lockfiles without `baton_version` are silently accepted (backward-compatible).
- Newer Baton reading an older lockfile produces no warning.
- `checkLockfileVersion(lockfile, currentVersion)` exported from `@baton-dx/core`.
