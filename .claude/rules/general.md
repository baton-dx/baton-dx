# General Rules

## Commits

- Follow conventional commits: `feat(cli): add profile wizard`, `fix(core): handle empty manifest`
- Scopes: `cli`, `core`, `agent-paths`, `docs`, `deps`
- Keep commits atomic — one logical change per commit

## Testing

- Tests co-located with source: `foo.ts` → `foo.test.ts` (same directory)
- Use vitest: `describe`, `it`, `expect`, `beforeEach`
- Test adapters for each AI tool — verify transforms and path resolution
- Mock file system operations in tests (no real I/O)

## File I/O

- All file operations use `fs/promises` — never use sync variants
- Handle missing files gracefully (try/catch with meaningful error messages)
- Use `path.join()` for cross-platform path construction

## Exports

- Named exports only (`export function`, `export class`, `export const`)
- Barrel exports in `index.ts` files for package public API
- Internal helpers should not be exported from `index.ts`
