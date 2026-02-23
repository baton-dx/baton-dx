---
"@baton-dx/core": patch
---

Fix self-update not actually updating to latest version by adding `--latest` flag for bun/pnpm and using `install @latest` for npm
