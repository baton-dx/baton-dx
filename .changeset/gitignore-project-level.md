---
"@baton-dx/cli": patch
---

Make .gitignore a project-level decision at init time instead of per-sync dynamic updates. Adds `gitignore` field to baton.yaml, comprehensive patterns for all known AI tools and IDE platforms, and fixes a bug where `.github/` was over-broadly gitignored instead of only `.github/copilot-instructions.md`.
