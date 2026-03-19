---
"@baton-dx/core": patch
---

Fix hard failure on transient ENOENT during cached repo read by falling through to re-clone instead of throwing
