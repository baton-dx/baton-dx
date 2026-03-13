---
"@baton-dx/cli": patch
"@baton-dx/core": patch
---

fix(core): resolve "latest" to HEAD instead of newest semver tag

`resolveVersion("latest")` previously preferred the highest semver tag, so
untagged commits on main were missed during sync. Now "latest" always resolves
to HEAD of the default branch. Semver matching only applies to explicit version
specs (e.g., `version: ^1.0.0`).

Also removes `checkRemoteSha` — sync now compares `resolveVersion` output
directly against the locked SHA, reducing ls-remote calls from two to one.
