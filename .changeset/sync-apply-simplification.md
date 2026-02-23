---
"@baton-dx/cli": minor
---

Restructure CLI commands: add `baton apply` for deterministic lock-based sync, change `baton sync` to always fetch latest versions, deprecate `baton update`

- `baton apply` — applies locked configurations from `baton.lock` (deterministic, reproducible)
- `baton sync` — fetches latest versions, places files, and updates lockfile
- `baton update` — deprecated, delegates to `baton sync` with a warning
- `baton.lock` is no longer added to `.gitignore` — commit it for reproducible team builds
