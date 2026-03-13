---
"@baton-dx/cli": patch
---

fix(cli): show current config state in scan commands

`ai-tools scan` and `ides scan` now display state-aware labels (`detected`, `saved`, `saved, not detected`) in the interactive multiselect and warn about configured tools/IDEs that were not detected on the system. This helps users understand what will change before confirming, without altering the default pre-selection (still detection-only).
