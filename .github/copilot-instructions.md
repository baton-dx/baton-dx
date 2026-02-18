# Baton — Copilot Instructions

Baton is a CLI package manager for Developer Experience & AI configuration. It manages Skills, Rules, Agents, Memory Files, Commands, and file configs as versioned, composable profiles for 14 AI coding tools.

## Architecture

Monorepo with 3 packages:

- `@baton-dx/agent-paths` — Zero-dependency path registry for all AI tools
- `@baton-dx/core` — Business logic (adapters, schemas, merge, sources, placement)
- `@baton-dx/cli` — User-facing CLI built with citty + @clack/prompts

Dependency flow: `agent-paths` → `core` → `cli`

## Key Conventions

- TypeScript strict mode — no `any` types
- Named exports only — no `export default`
- Zod schemas as source of truth — derive types with `z.infer<typeof schema>`
- Functional composition — except adapters (class inheritance via `BaseAdapter`)
- Tests co-located — `foo.test.ts` next to `foo.ts` (vitest)
- Async file I/O — always `fs/promises`
- Conventional commits — `feat(cli):`, `fix(core):`, `refactor(agent-paths):`
- Biome formatting — run `bun run lint` before committing

## Full Reference

See `CLAUDE.md` in the repository root for comprehensive documentation including all CLI commands, adapter patterns, merge strategies, schemas, and development setup.
