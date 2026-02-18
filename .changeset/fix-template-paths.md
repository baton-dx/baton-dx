---
"@baton-dx/cli": patch
---

Fix template path resolution in bundled CLI for `source create` and `profile create` commands

Both commands referenced templates via `src/templates/` which doesn't exist in the published package. Templates are copied to `dist/templates/` by tsdown's `copy` config, so paths now resolve relative to `__dirname` (the `dist/` directory) instead of navigating up to a non-existent `src/` directory.
