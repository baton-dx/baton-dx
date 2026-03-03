---
"@baton-dx/cli": patch
---

Fix CLI hanging when git operations require authentication. Git commands now try non-interactive mode first and automatically retry with interactive prompts (browser OAuth, credential manager) when auth is needed.
