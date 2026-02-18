# CLI Patterns Checklist (citty + @clack/prompts)

## Command Structure (citty)
- [ ] Each command uses `defineCommand()` with `meta` (name, description)
- [ ] Arguments defined with proper types, descriptions, and defaults
- [ ] Required vs optional arguments clearly marked
- [ ] `run` handler is async and contains the command logic
- [ ] Subcommands properly nested and registered in parent command
- [ ] Command help text is clear and shows usage examples

## User Interaction (@clack/prompts)
- [ ] All user-facing prompts use `@clack/prompts` (not raw `readline`, `inquirer`, or `process.stdin`)
- [ ] `intro()` and `outro()` used to frame CLI sessions
- [ ] `spinner()` used for long-running operations (file I/O, git, network)
- [ ] `confirm()` used before destructive operations
- [ ] `select()` / `multiselect()` for choices with clear labels
- [ ] `cancel()` handled gracefully (user hits Ctrl+C)
- [ ] `note()` used for important multi-line information
- [ ] No `console.log` in user-facing code — use `log.info`, `log.warn`, `log.error` from @clack/prompts

## Error Handling
- [ ] User-facing errors show friendly messages, not raw stack traces
- [ ] File-not-found errors suggest what the user should do (e.g., "Run `baton init` first")
- [ ] Invalid input errors reference the expected format
- [ ] Exit codes: 0 for success, 1 for user errors, 2 for unexpected errors
- [ ] Errors from child processes (git, file system) are caught and contextualized

## CLI UX
- [ ] Commands are idempotent where possible (running twice doesn't break things)
- [ ] Dry-run or preview mode available for destructive operations
- [ ] Output is minimal by default, verbose with `--verbose` flag
- [ ] File paths in output are relative to project root (not absolute)
- [ ] Colors/formatting degrade gracefully in non-TTY environments (CI/CD)

## Package Structure
- [ ] CLI entry point is `packages/cli/src/index.ts`
- [ ] Each command in its own file under `packages/cli/src/commands/`
- [ ] Shared CLI utilities in `packages/cli/src/utils/`
- [ ] Templates in `packages/cli/src/templates/`
- [ ] CLI depends on `@baton-dx/core` for business logic (no business logic in CLI package)
