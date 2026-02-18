---
name: dead-code
description: Find all unused code, exports, files, dependencies, and unreferenced resources in the Baton monorepo. Use when the user wants to clean up the codebase, find unused code, or reduce package size.
allowed-tools: Read, Grep, Glob, Bash
model: sonnet
---

# Dead Code Finder

Systematically identify all unused and unreferenced code in this TypeScript CLI monorepo.

## Step 1: Run Knip (structural analysis)

```bash
bun run dead-code 2>&1
```

Parse the output and categorize findings into: unused files, unused exports, unused dependencies, unlisted dependencies.

## Step 2: Check what Knip misses

Knip catches most structural dead code, but manually check these project-specific patterns:

### Unused Adapters
```bash
# List all adapter files
ls packages/core/src/adapters/*.ts

# Check if each adapter is registered in registry.ts
# grep -r "AdapterName" packages/core/src/adapters/registry.ts
```

### Unused CLI Commands
```bash
# List all command files
ls packages/cli/src/commands/*.ts

# Check if each command is registered in the CLI entry point
# grep -r "commandName" packages/cli/src/index.ts
```

### Unused Zod Schemas
```bash
# Find all exported schemas
grep -rn "export const.*Schema\|export const.*schema" packages/core/src/schemas/

# For each schema, verify it's imported somewhere
# grep -r "SchemaName" packages/ --include="*.ts" | grep -v "schemas/"
```

### Unused Utility Functions
```bash
# Find all exports in utils directories
grep -rn "export " packages/*/src/utils/ 2>/dev/null

# Cross-reference with imports
# grep -r "from.*utils" packages/ --include="*.ts"
```

### Unused Agent Path Entries
```bash
# List all registry entries
grep -n "export\|register" packages/agent-paths/src/registry.ts

# Verify they're used by adapters or CLI
# grep -r "agentPaths\|getPath" packages/core/ packages/cli/ --include="*.ts"
```

### Orphaned Test Files
```bash
# Find test files whose source file no longer exists
find packages/ -name "*.test.ts" 2>/dev/null
# For each, check if the corresponding source file exists
```

### Commented-Out Code
```bash
# Find large blocks of commented code (3+ consecutive comment lines)
grep -n "^[[:space:]]*//" packages/*/src/**/*.ts 2>/dev/null | head -30
```

## Step 3: Compile Report

Organize findings by severity:

### Safe to Remove (no references anywhere)
- Unused files
- Unused exports
- Unused dependencies

### Likely Dead (verify before removing)
- Adapters not registered in registry
- Schemas not used in validation
- Commands not wired into CLI

### Needs Investigation
- Dynamic imports via `await import()`
- Conditional requires
- Exports consumed by external packages (create-baton or user projects)

## Step 4: Suggest Removal Order

Provide a safe removal order that avoids breaking the build:
1. Dependencies first (from individual `package.json` files)
2. Leaf files (no other file depends on them)
3. Intermediate files (after their dependents are removed)
4. Schema changes last (may affect downstream consumers)
