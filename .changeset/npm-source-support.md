---
"@baton-dx/core": minor
"@baton-dx/cli": patch
---

Add complete NPM source support with caching for sync, diff, and inheritance

- NPM sources now work in profile inheritance chains (`extends: npm:@scope/package`)
- `baton sync` resolves NPM sources alongside Git sources
- `baton diff` compares local files against NPM package contents
- Persistent NPM package cache in `~/.baton/cache/npm/` for faster repeated operations
