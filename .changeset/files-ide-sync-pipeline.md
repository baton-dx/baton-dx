---
"@baton-dx/core": patch
---

Wire `files/` and `ide/` discovery into the sync pipeline

Profile `files/` and `ide/` directories were correctly discovered by `discoverProfile()` but never wired into the sync/apply pipeline — the assembly step produced empty maps, so files were never placed and previously placed files were flagged as orphans.

`assembleContentFromDiscovery()` now processes `discovery.files` and `discovery.ide`, producing `FileEntry[]` and `IdeEntry[]` with last-wins dedup semantics. The sync, apply, and preview commands consume the assembled data. Unknown IDE platforms produce a warning and are skipped.
