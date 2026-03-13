---
"@baton-dx/cli": patch
---

fix(cli): `baton preview` now correctly shows resolution errors and resolves paths for extended profiles

- Resolution errors are collected and displayed via `p.log.error()` after the spinner stops, instead of being silently lost via `spinner.message()`
- Extended profiles in a chain now get their own correct `localPath` instead of inheriting the root profile's path
