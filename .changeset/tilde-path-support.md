---
"@baton-dx/cli": patch
---

fix(core): support `~/` home-relative paths in local sources

`parseSource()` now accepts `~/…` paths (e.g. `~/Sites/baton/test-v1`) as valid local sources. Previously these threw a `SourceParseError` and were stored raw in `baton.yaml`, causing all subsequent commands to fail.

A new `expandLocalPath(path, baseDir)` helper replaces all path-resolution spots across `sync`, `apply`, `init`, `manage`, `diff`, `preview`, `source connect`, and internal utilities so that `~/`, `/`, `./`, and `../` paths all resolve correctly.

`baton source connect` additionally normalises `./`/`../` paths to absolute before storing, so the saved URL is never cwd-dependent.
