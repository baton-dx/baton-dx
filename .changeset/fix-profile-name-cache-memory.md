---
"@baton-dx/cli": patch
"@baton-dx/core": patch
---

Fix profile name validation to allow digit-prefixed names (e.g., "3d"), fix sparse-checkout cache corruption when multiple profiles share the same git source, and suppress false memory weight-conflict warnings when profiles use identical merge strategies.
