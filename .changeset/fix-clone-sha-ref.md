---
"@baton-dx/cli": patch
---

Fix git clone failing when source version is a commit SHA

`git clone --branch` only accepts branch/tag names, not commit SHAs. When the lockfile or `baton update` resolves a version to a commit SHA, cloning now correctly fetches the specific commit instead of passing it as `--branch`.
