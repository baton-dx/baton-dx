---
"@baton-dx/cli": patch
---

Fix profile inheritance (extends) not working during sync — parent profile content (memory, rules, skills, files, commands) was silently skipped because inherited profiles were not registered in the local path map
