---
"@baton-dx/cli": minor
"@baton-dx/core": minor
---

Simplify `extends` to single string, add profile hierarchy tree, upgrade Biome to v2

**Breaking:** `extends` in `baton.profile.yaml` now accepts a single profile name (string) instead of an array. Update `extends: [base]` to `extends: base`.

**feat(core):**
- `extends` simplified from `string[]` to `string` — one parent per profile, resolved as sibling directory
- Profile chain cycle detection and maximum-depth enforcement updated accordingly
- Validation Check 13: verifies sibling profile exists when `extends` is set
- Validation Check 16: detects extend loops (direct and indirect) across the source
- Validation Check 17: warns when sibling profiles share the same weight

**feat(cli):**
- `baton profile list` now shows a hierarchy tree (parent → child) above the table
- Profile table includes `Weight` and `Extends` columns
- `baton manage` add-profile upgraded to multi-select (install multiple profiles at once)
- `baton manage` overview shows `weight` and `inherits` metadata per installed profile, with same-weight conflict warnings

**chore:** Biome upgraded from 1.x to 2.x; `organizeImports` migrated to `assist.actions.source`
