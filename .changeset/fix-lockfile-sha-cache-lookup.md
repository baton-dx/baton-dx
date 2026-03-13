---
"@baton-dx/cli": patch
"@baton-dx/core": patch
---

fix(core): lockfile SHA cache lookup by source field instead of mismatched key

The lockfile SHA cache was never hit because write used profile name as key but read used `getPackageNameFromSource()` (org/repo). Replaced key-based lookup with `findLockedPackageBySource()` that scans by the `source` field, which is consistent between write and read paths.
