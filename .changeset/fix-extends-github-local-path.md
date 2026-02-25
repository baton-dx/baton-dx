---
"@baton-dx/core": patch
---

fix(core): resolve extends sibling path for GitHub/npm/git sources

`resolveProfileChain` passed `localPath: undefined` for non-local sources (github, gitlab, npm, git), causing `resolveExtendsToPath` to return the raw profile name (e.g. `"react"`) instead of the resolved sibling path. This triggered `Invalid source format: "react"` when syncing a profile with `extends`.

For non-local providers, callers always pass the cloned profile directory as `baseDir` (i.e. `dirname(manifestPath)`), so it is now used directly as `initialLocalPath`. Error messages now show the original `extends` name instead of the resolved internal path.
