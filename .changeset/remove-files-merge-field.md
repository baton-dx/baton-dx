---
"@baton-dx/core": patch
---

Remove unused `merge` field from file config items in profile manifest schema. Files are deduplicated by target path (last-wins by weight), not merged. Merge strategies only apply to memory items.
