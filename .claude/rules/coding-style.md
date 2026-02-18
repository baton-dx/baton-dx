# Coding Style

## TypeScript

- Use TypeScript strict mode — no `any` types, use `unknown` + type narrowing
- Derive types from Zod schemas: `type Foo = z.infer<typeof fooSchema>`
- Prefer `interface` for object shapes, `type` for unions and intersections
- Use `readonly` for adapter properties (`readonly key: string`)

## Formatting

- Biome handles formatting — run `bun run lint` before committing
- Import order: Node built-ins → external packages → workspace packages (`@baton-dx/*`) → relative imports
- Named exports only — never use `export default`
- One export per declaration (no `export { a, b, c }` barrel re-exports except in `index.ts`)

## Functions & Structure

- Prefer functional composition over classes (exception: adapters use class inheritance)
- Keep functions under ~50 lines — extract helpers for complex logic
- No `console.log` in library code (`@baton-dx/core`, `@baton-dx/agent-paths`) — use structured error returns
- CLI output uses `@clack/prompts` (never raw `console.log` for user-facing output)
