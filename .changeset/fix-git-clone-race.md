---
"@baton-dx/core": patch
---

Fix race condition in Git clone when multiple profiles share the same source repository

When a project uses multiple profiles from the same Git source (e.g., `profiles/typo3` + `profiles/base`), concurrent `baton sync` operations would race to clone the same cache directory, causing "destination path already exists" errors. This adds per-cache-path serialization so concurrent clones to the same path are queued instead of colliding.

Also fixes SHA ref handling in cache refresh paths — `origin/<sha>` is not a valid Git ref, so stale cache updates with resolved SHAs (from `resolveVersion`) would always fail and force unnecessary fresh clones. Now correctly uses `git fetch origin <sha>` + `git reset --hard FETCH_HEAD`.
