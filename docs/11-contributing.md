# Contributing to Baton

Thank you for your interest in contributing to Baton! This guide covers everything you need to get started.

## Getting Started

### Prerequisites

- Node.js ≥ 20
- Bun (package manager and runtime)
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/baton-dx/baton-dx.git
cd baton-dx

# Install dependencies
bun install

# Build all packages
bun run build

# Link the CLI globally (for testing)
bun link --cwd packages/cli

# Verify
baton --version
```

### Development CLI

To test local changes without overwriting your installed `baton`, add a shell alias that points directly to the built CLI:

```bash
# Add to your ~/.zshrc or ~/.bashrc
baton-dev() {
  node /path/to/baton-dx/packages/cli/dist/index.mjs "$@"
}
```

Then build and test from any project:

```bash
bun run build        # rebuild after changes
baton-dev sync       # runs your local build
```

Alternatively, use `bun run dev` from the repo root to run from source without building:

```bash
bun run dev -- sync
```

## Project Structure

```
baton-dx/
├── packages/
│   ├── ai-tool-paths/   # @baton-dx/ai-tool-paths — Path registry (zero deps)
│   ├── core/            # @baton-dx/core — Business logic
│   └── cli/             # @baton-dx/cli — User-facing CLI
├── docs/                # Documentation
├── test-fixtures/       # Shared test fixtures
└── .claude/             # AI assistant configuration
    ├── skills/          # Development skills
    ├── agents/          # Specialized agents
    └── rules/           # Coding rules
```

**Dependency flow:** `ai-tool-paths` → `core` → `cli` (one direction only).

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```

### 2. Make Changes

Follow the coding conventions below. Key principles:

- **TypeScript strict mode** — no `any` types
- **Named exports only** — no `export default`
- **Functional composition** — except adapters (class inheritance)
- **Async file I/O** — always `fs/promises`
- **Zod schemas** — source of truth for all data types
- **Co-located tests** — `foo.test.ts` next to `foo.ts`

### 3. Verify

```bash
bun run typecheck   # TypeScript strict check
bun run lint        # Biome linting
bun run test        # Vitest tests
bun run build       # Build all packages
```

### 4. Commit

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat(cli): add profile wizard"
git commit -m "fix(core): handle empty manifest"
git commit -m "refactor(ai-tool-paths): simplify registry lookup"
git commit -m "docs: update CLI reference"
git commit -m "test(core): add cursor adapter tests"
```

**Scopes:** `cli`, `core`, `ai-tool-paths`, `docs`, `deps`

### 5. Submit Pull Request

```bash
git push origin feature/your-feature-name
```

Open a PR against `main` with:
- Description of changes
- Related issue numbers
- Testing performed

## AI-Assisted Development

Baton provides an official **maintainer profile** via [`baton-dx-source`](https://github.com/baton-dx/baton-dx-source) that gives your AI tools full context about this monorepo's architecture, coding conventions, and development workflows.

```bash
baton init --profile github:baton-dx/baton-dx-source/maintainer
baton sync
```

### What the maintainer profile includes

The maintainer profile includes:

- **Memory** — Full monorepo architecture (ai-tool-paths → core → cli), adapter pattern, CLI commands, release workflow
- **8 Skills** — `add-adapter`, `add-ide-platform`, `review-code`, `find-dead-code`, `find-redundancy`, `create-pr`, `run-release`, `run-review`
- **2 Agents** — `code-quality-auditor` (deep analysis), `consolidation-scout` (redundancy detection)
- **3 Rules** — `general` (commits, testing, async I/O), `coding-style` (TypeScript strict, Biome), `api-conventions` (citty, clack, Zod)
- **3 Commands** — `/build`, `/quality`, `/verify`

All configurations are automatically transformed and placed for whichever AI tools you use (Claude Code, Cursor, Windsurf, etc.).

---

## Common Contribution Tasks

### Adding a New AI Tool Adapter

Use the `add-adapter` skill for step-by-step guidance. Changes span all 3 packages:

1. Add path config to `packages/ai-tool-paths/src/registry.ts`
2. Create adapter class in `packages/core/src/adapters/<tool>.ts`
3. Register in `packages/core/src/adapters/registry.ts`
4. Add tests in `packages/core/src/adapters/<tool>.test.ts`

### Adding a New IDE Platform

Use the `add-ide-platform` skill. Changes needed:

1. Add to `packages/core/src/ide/platform-registry.ts`
2. Add detection logic
3. Update `docs/09-ide-platforms-reference.md`

### Creating Test Source Repositories

Use `baton source create` to scaffold test sources for development. See [Creating Sources](03-creating-sources.md) for details.

### Working with Profiles

Use `baton profile create` to create new profiles. See [Creating Profiles](04-creating-profiles.md) for details.

## Running Tests

```bash
# All tests
bun run test

# Watch mode
bun run test --watch

# Single package
cd packages/core && bun test

# Specific file
bun test packages/core/src/adapters/cursor.test.ts
```

## Code Quality

```bash
# Lint
bun run lint

# Type check
bun run typecheck

# Find unused exports
bun run dead-code
```

## Architecture Guidelines

### Core vs CLI Separation

- `@baton-dx/core` — Business logic only. No UI, no prompts, no `process.exit()`.
- `@baton-dx/cli` — User interaction, output formatting, error display.
- Core functions return results/errors; CLI decides how to present them.

### Adapter Pattern

All AI tool adapters implement `AIToolAdapter` (from `core/src/adapters/types.ts`) and most extend `BaseAIToolAdapter`. Override only what differs from the default behavior.

### Schema-First Design

Define data shapes as Zod schemas first, then derive TypeScript types with `z.infer<>`. Validate at system boundaries (file reads, CLI input, external data).

## Questions?

- Check existing [issues](https://github.com/baton-dx/baton-dx/issues)
- Open a new issue with the "question" label

## Code of Conduct

This project follows a [Contributor Code of Conduct](../CODE_OF_CONDUCT.md). By participating, you agree to abide by its terms.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
