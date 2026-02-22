---
"@baton-dx/cli": minor
---

Remove `settings` ConfigType — tool-specific settings files should use the generic `files` structure with `source`/`target` instead. Also removes unused `lockfile/index.ts` barrel export and orphaned `execa` dependency.
