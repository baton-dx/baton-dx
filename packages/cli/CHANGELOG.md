# @baton-dx/cli

## 0.2.0

### Minor Changes

- [#15](https://github.com/baton-dx/baton-dx/pull/15) [`f41504d`](https://github.com/baton-dx/baton-dx/commit/f41504d7555728f13b20f4f70824c752cbb8260d) Thanks [@mantaray0](https://github.com/mantaray0)! - Redesign detection system for AI tools and IDEs to eliminate false positives

  - Replace flat OR-based detection with structured DetectionConfig using OR-of-ANDs evaluation logic
  - Add 5 detection mechanisms: binary (with version verification), directory (with marker files), macOS app bundles, VS Code extensions, JetBrains plugins
  - Fix false positives: GitHub Copilot no longer detected from `gh` CLI, leftover directories no longer trigger detection without marker files, binary name collisions prevented via version pattern matching
  - Add cross-platform support for binary lookup (`which` on Unix, `where` on Windows)
  - Populate detection configs for all 14 AI tools and 6 IDE platforms
  - Remove legacy `detection: string[]` field in favor of typed `detectionConfig`
  - Consolidate shared detection helpers into single `mechanisms.ts` module

## 0.1.5

### Patch Changes

- [#13](https://github.com/baton-dx/baton-dx/pull/13) [`cce3c61`](https://github.com/baton-dx/baton-dx/commit/cce3c61c986d3c8e33b7419eddb4f1505ad946d7) Thanks [@mantaray0](https://github.com/mantaray0)! - Fix profile inheritance (extends) not working during sync — parent profile content (memory, rules, skills, files, commands) was silently skipped because inherited profiles were not registered in the local path map

## 0.1.4

### Patch Changes

- [#10](https://github.com/baton-dx/baton-dx/pull/10) [`de49425`](https://github.com/baton-dx/baton-dx/commit/de49425d690b3a496d4dd4202bd30d130799158e) Thanks [@mantaray0](https://github.com/mantaray0)! - Add explicit `permissions: contents: read` to CI workflow to satisfy GitHub security audit (least-privilege principle)

- [#8](https://github.com/baton-dx/baton-dx/pull/8) [`50b6f1d`](https://github.com/baton-dx/baton-dx/commit/50b6f1d77293997c943b3b2c2297a6064374a5e1) Thanks [@mantaray0](https://github.com/mantaray0)! - Fix template path resolution in bundled CLI for `source create` and `profile create` commands

  Both commands referenced templates via `src/templates/` which doesn't exist in the published package. Templates are copied to `dist/templates/` by tsdown's `copy` config, so paths now resolve relative to `__dirname` (the `dist/` directory) instead of navigating up to a non-existent `src/` directory.

## 0.1.3

### Patch Changes

- [`97e9e8f`](https://github.com/baton-dx/baton-dx/commit/97e9e8f4d4b21b8f7f2b52374d4dcd64d97420a3) Thanks [@mantaray0](https://github.com/mantaray0)! - Include root README.md in published npm package via prepack script.

## 0.1.2

### Patch Changes

- [`dcc30a9`](https://github.com/baton-dx/baton-dx/commit/dcc30a9a87e2ef98144dc467f254d3c0ed766cb5) Thanks [@mantaray0](https://github.com/mantaray0)! - Bundle all workspace dependencies into CLI build for zero-dependency install. `core` and `agent-paths` are now private packages bundled via tsdown aliases. Adds `btx` as a short CLI alias.

## 0.1.1

### Patch Changes

- Fix install commands to use correct scoped package name (`@baton-dx/cli` instead of `baton-dx`) and add `btx` as a short CLI alias alongside `baton` and `baton-dx`.

- Updated dependencies []:
  - @baton-dx/agent-paths@0.1.1
  - @baton-dx/core@0.1.1
