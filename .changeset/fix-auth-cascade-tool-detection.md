---
"@baton-dx/core": patch
"@baton-dx/cli": patch
---

fix(core): reorder auth cascade to follow git credential best practices

- Reorder auth cascade: env → git credential fill → gh-cli → SSH (was env → SSH → gh-cli → git credential)
- Respect user's GIT_SSH_COMMAND in createGit() and SSH connectivity check
- Add optional diagnostic logger and triedMethods to auth cascade
- Add runAuthDiagnostic() for full non-short-circuit cascade results

fix(cli): use resolvePreferences consistently in manage and config commands

- Fix manage.ts Overview to use resolvePreferences() instead of raw getGlobalAiTools()
- Fix config/index.ts Active Intersections to use resolved preferences
- Add `baton auth status` diagnostic command
- Wire verbose logger to auth cascade in sync command
