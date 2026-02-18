# Core Conventions Checklist (Baton Monorepo)

## Zod Schemas
- [ ] Schemas defined in `packages/core/src/schemas/` as the single source of truth
- [ ] Types derived from schemas via `z.infer<typeof SomeSchema>` (no manual type duplication)
- [ ] `z.object().extend()` or `.merge()` used for schema composition
- [ ] `.parse()` for trusted input, `.safeParse()` for user/external input
- [ ] Schema validation at boundaries: config file reads, CLI input, external data
- [ ] Discriminated unions (`z.discriminatedUnion()`) for variant types
- [ ] Sensible `.default()` values where applicable
- [ ] Schema exports are named (no `export default`)

## Adapter Pattern
- [ ] Each AI tool adapter in its own file under `packages/core/src/adapters/`
- [ ] Adapters registered in `packages/core/src/adapters/registry.ts`
- [ ] Adapters follow the established interface/type contract
- [ ] Shared logic extracted into registry or helper — not duplicated per adapter
- [ ] Adapter tests co-located: `adapter-name.test.ts` next to `adapter-name.ts`
- [ ] Path resolution uses `@baton-dx/agent-paths` registry, not hardcoded paths

## Functional Composition
- [ ] Functions over classes as default (classes only where adapter pattern requires it)
- [ ] Pure functions where possible (no hidden side effects)
- [ ] Composable pipeline patterns for data transformations (merge, placement, substitution)
- [ ] Small, focused functions (< 50 lines)
- [ ] Higher-order functions for shared behavior patterns

## TypeScript Conventions
- [ ] Strict mode enabled — no `any` types
- [ ] `unknown` + type narrowing for uncertain types
- [ ] Named exports only — `export default` is forbidden
- [ ] Barrel exports from `index.ts` in each package
- [ ] Generics used for reusable utilities, not over-abstracted
- [ ] Discriminated unions for state/result types
- [ ] Proper error typing — custom error classes or result types

## File I/O
- [ ] All file operations use `fs/promises` (async) — no `fs.readFileSync` etc.
- [ ] Proper error handling for missing files (ENOENT)
- [ ] Directory creation before writes (`mkdir` with `{ recursive: true }`)
- [ ] JSON files parsed with error handling
- [ ] File paths built with `path.join()` / `path.resolve()` — no string concatenation

## Package Boundaries
- [ ] `@baton-dx/core` has no dependency on `@baton-dx/cli` (no circular deps)
- [ ] `@baton-dx/agent-paths` is standalone — no deps on `core` or `cli`
- [ ] Business logic lives in `core`, not in `cli` commands
- [ ] CLI imports from `@baton-dx/core` package, not from relative `../../core/` paths
- [ ] Each package has clean `index.ts` barrel exports

## Testing (Vitest)
- [ ] Tests co-located with source: `foo.test.ts` next to `foo.ts`
- [ ] Test file naming: `<module>.test.ts` (not `__tests__/` directory)
- [ ] Adapter tests verify config generation for each AI tool
- [ ] Edge cases covered (empty input, missing files, malformed config)
- [ ] No test dependencies on file system state (use temp dirs or mocks)
- [ ] `describe` blocks match module/function names
- [ ] Run with `bun run test` (vitest)

## Git Operations
- [ ] Uses `simple-git` library — no raw `child_process` for git
- [ ] Git operations are async
- [ ] Proper error handling for git failures (not a repo, dirty state, conflicts)
- [ ] No hardcoded branch names — respect user's configuration
