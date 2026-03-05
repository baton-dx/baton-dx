---
"@baton-dx/cli": patch
---

fix(cli): propagate auth to all git clone call sites

Auth resolved in Step 1 (profile resolution) was not carried forward to Step 5 (file placement),
causing unauthenticated HTTPS clones and cache key mismatches for SSH-only users.

- sync/apply: store authenticated URL + token in `sourceAuth` map, reuse in Step 5
- manage: add auth cascade to `loadInstalledProfileMeta()` for private repo metadata
- init: add auth cascade to `showProfileIntersections()` for private repo intersection display
- profile-chain: thread optional `authToken`/`cloneUrl` through `CloneContext` for cross-repo extends
