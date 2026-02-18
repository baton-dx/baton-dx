# API Conventions

## CLI Commands (citty)

- Define commands with `defineCommand()` from citty
- Use `meta.name` and `meta.description` for every command
- Declare `args` with types, descriptions, and aliases
- Subcommands go in their own files: `commands/<name>/index.ts`

## User Interaction (@clack/prompts)

- Use `@clack/prompts` for all interactive user input (select, confirm, text, multiselect)
- Wrap interactive flows with `intro()` / `outro()`
- Check for `--yes` flag to skip prompts in non-interactive mode
- Provide meaningful cancel messages when user exits

## Validation

- Input validation with Zod schemas — `schema.safeParse()` for user input, `schema.parse()` for trusted data
- Return structured errors, not thrown exceptions, from core functions
- Validate at system boundaries (CLI input, file reads, external data) — trust internal types

## Core vs CLI Separation

- `@baton-dx/core` contains all business logic — no UI, no prompts, no `process.exit()`
- `@baton-dx/cli` handles user interaction, output formatting, and error display
- Core functions return results/errors; CLI decides how to present them
- Core never imports from CLI — dependency flows one direction only
