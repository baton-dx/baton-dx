---
"@baton-dx/core": patch
---

fix: lockfile stores logical source reference for `extends`-derived profiles

Previously, when a remote profile (e.g. `github:org/repo/profiles/maintainer`) used `extends`
to reference a sibling profile, the sibling's `source` and `resolved` fields in `baton.lock`
were set to the user-specific local cache path (e.g. `/Users/name/.baton/cache/.../profiles/base`).
This caused the lockfile to contain machine-specific absolute paths that should not be committed.

The fix threads a `logicalSource` value separately from the cycle-detection key through
`resolveChainRecursive`. For extends-derived siblings, the logical source is derived by replacing
the last path segment of the parent's logical source with the sibling name:

```
github:baton-dx/baton-dx-source/profiles/maintainer  +  extends: base
  → github:baton-dx/baton-dx-source/profiles/base
```

The lockfile now correctly stores portable, machine-independent references for all profiles.
