---
"@baton-dx/cli": patch
---

Extract reusable placed-file cleanup to core

- Add `removePlacedFiles()` to `@baton-dx/core` for cleaning up lockfile-tracked placed files
- Refactor `baton sync` cleanup to use the shared function
- Wire placed-file cleanup into the "Remove Baton" flow in `baton manage`
- Normalize lockfile paths to relative, fixing an EISDIR bug when removing directories
