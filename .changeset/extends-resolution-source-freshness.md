---
"@baton-dx/cli": patch
---

Fix profile extends resolution, source freshness, and profile discovery

- Fix sparse-checkout expansion for `extends` chains: parent profiles referenced via `extends` in remote sources are now correctly loaded by expanding the git sparse-checkout on demand
- Replace silent error swallowing with hard errors when an `extends` target cannot be resolved
- Add automatic source cache freshness check with configurable TTL (default: 24 hours)
- Add `--fresh` flag to `baton sync` to force immediate source refresh
- Add `baton config set` subcommand for programmatic config changes (e.g., `baton config set sync.cacheTtlHours 1`)
- Fix profile discovery in `baton init` and `baton manage` to show all available profiles instead of only "base"
