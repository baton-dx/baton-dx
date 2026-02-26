---
"@baton-dx/cli": minor
---

Fix memory deduplication for diamond inheritance and add unified "Manage profiles" flow.

- **fix(core):** Memory contributions are now deduplicated when the same base profile appears multiple times via diamond inheritance (e.g., `react extends base` + `vue extends base`). Skills/rules were unaffected due to Map-based dedup.
- **feat(cli):** Replace separate "Add profile" / "Remove profile" menu items in `baton manage` with a single "Manage profiles" entry. Shows all available profiles as a cascading multiselect with pre-selected installed profiles. Supports adding and removing profiles in one step.
- **feat(cli):** Add `initialValues` support to cascading multiselect for pre-selecting profiles.
