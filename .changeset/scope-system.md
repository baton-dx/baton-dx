---
"@baton-dx/core": patch
"@baton-dx/cli": patch
---

Add scope system for all config types

- Add `resolveScope()` helper with 3-tier cascade: item → profile → "project" default
- Support optional `scope` field on profile manifest, rules, agents, memory, and skills
- Replace hardcoded "project" scope in sync, apply, and diff commands
- Backward-compatible: existing profiles without scope continue to default to "project"
