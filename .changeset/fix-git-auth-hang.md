---
"@baton-dx/cli": patch
---

Fix CLI hanging when git operations require authentication. Baton now resolves credentials automatically via an auth cascade (environment variables → SSH keys → GitHub CLI → git credential helper) and shows a clear error with setup instructions when no auth is found. Git operations never prompt interactively.
