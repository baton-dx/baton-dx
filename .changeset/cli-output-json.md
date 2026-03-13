---
"@baton-dx/cli": minor
---

feat(cli): add --json output for CI/CD integration + standardize CLI output

- Global `--json` flag (`-j`) for machine-readable JSON output on all list/scan/sync/apply/diff/config/auth commands
- Consistent JSON envelope: `{ success, data, warnings, errors }`
- Migrated all `console.log()` in commands to `@clack/prompts` API
- Replaced manual ANSI escape codes with `picocolors`
- Shared table renderer utility (`renderTable`) for list commands
- Global `--verbose` flag wired through `getOutputContext()` helper
