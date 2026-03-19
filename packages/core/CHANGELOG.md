# @baton-dx/core

## 1.0.4

### Patch Changes

- c5c3652: Fix ENOTEMPTY race condition in git cache cleanup on macOS
  - @baton-dx/ai-tool-paths@1.0.4

## 1.0.3

### Patch Changes

- 8e5807e: Wire `files/` and `ide/` discovery into the sync pipeline

  Profile `files/` and `ide/` directories were correctly discovered by `discoverProfile()` but never wired into the sync/apply pipeline — the assembly step produced empty maps, so files were never placed and previously placed files were flagged as orphans.

  `assembleContentFromDiscovery()` now processes `discovery.files` and `discovery.ide`, producing `FileEntry[]` and `IdeEntry[]` with last-wins dedup semantics. The sync, apply, and preview commands consume the assembled data. Unknown IDE platforms produce a warning and are skipped.

  - @baton-dx/ai-tool-paths@1.0.3

## 1.0.2

### Patch Changes

- e66b721: Default to all AI tools when no `ai.tools` is declared in profile or source manifest

  In Baton 1.0, AI content (skills, rules, agents, memory) is auto-discovered from the filesystem — it is no longer declared in the manifest YAML. The previous `hasAiContent()` check looked at the manifest's `ai` field to decide whether to apply the implicit wildcard, but profiles using convention-over-configuration have no `ai:` section in their YAML at all. This caused the intersection to resolve to zero tools, blocking sync with "No AI tools in intersection".

  Now, when neither the profile nor the source manifest declares `ai.tools`, the default is all registered tools (implicit wildcard). To explicitly opt out, set `ai.tools: []`.

  - @baton-dx/ai-tool-paths@1.0.2

## 1.0.1

### Patch Changes

- 8396d1d: Fix race condition in Git clone when multiple profiles share the same source repository

  When a project uses multiple profiles from the same Git source (e.g., `profiles/typo3` + `profiles/base`), concurrent `baton sync` operations would race to clone the same cache directory, causing "destination path already exists" errors. This adds per-cache-path serialization so concurrent clones to the same path are queued instead of colliding.

  Also fixes SHA ref handling in cache refresh paths — `origin/<sha>` is not a valid Git ref, so stale cache updates with resolved SHAs (from `resolveVersion`) would always fail and force unnecessary fresh clones. Now correctly uses `git fetch origin <sha>` + `git reset --hard FETCH_HEAD`.

  - @baton-dx/ai-tool-paths@1.0.1

## 1.0.0

### Patch Changes

- f4f5292: Make expression condition operators case-insensitive — uppercase `OR`, `AND`, `NOT` (and mixed-case variants) now tokenize correctly instead of silently failing open
- 083dc16: fix(core): lockfile SHA cache lookup by source field instead of mismatched key

  The lockfile SHA cache was never hit because write used profile name as key but read used `getPackageNameFromSource()` (org/repo). Replaced key-based lookup with `findLockedPackageBySource()` that scans by the `source` field, which is consistent between write and read paths.

- 7c8e094: fix(core): resolve "latest" to HEAD instead of newest semver tag

  `resolveVersion("latest")` previously preferred the highest semver tag, so
  untagged commits on main were missed during sync. Now "latest" always resolves
  to HEAD of the default branch. Semver matching only applies to explicit version
  specs (e.g., `version: ^1.0.0`).

  Also removes `checkRemoteSha` — sync now compares `resolveVersion` output
  directly against the locked SHA, reducing ls-remote calls from two to one.

- fd7f54b: Strict expression syntax: uppercase-only operators (AND, OR, NOT, IN) and new IN operator for set membership

  **Breaking:** Expression conditions now require uppercase operators only. Lowercase (`and`, `or`, `not`) and symbol aliases (`&&`, `||`, `!`) are no longer accepted — they produce parse errors. Use `AND`, `OR`, `NOT` instead.

  **New:** `IN` and `NOT IN` operators for concise multi-value matching:

  - `tool IN ['claude-code', 'cursor', 'windsurf']`
  - `tool NOT IN ['aider', 'codex']`
  - @baton-dx/ai-tool-paths@1.0.0

## 1.0.0-alpha.13

### Patch Changes

- 7c8e094: fix(core): resolve "latest" to HEAD instead of newest semver tag

  `resolveVersion("latest")` previously preferred the highest semver tag, so
  untagged commits on main were missed during sync. Now "latest" always resolves
  to HEAD of the default branch. Semver matching only applies to explicit version
  specs (e.g., `version: ^1.0.0`).

  Also removes `checkRemoteSha` — sync now compares `resolveVersion` output
  directly against the locked SHA, reducing ls-remote calls from two to one.

  - @baton-dx/ai-tool-paths@1.0.0-alpha.13

## 1.0.0-alpha.12

### Patch Changes

- 083dc16: fix(core): lockfile SHA cache lookup by source field instead of mismatched key

  The lockfile SHA cache was never hit because write used profile name as key but read used `getPackageNameFromSource()` (org/repo). Replaced key-based lookup with `findLockedPackageBySource()` that scans by the `source` field, which is consistent between write and read paths.

  - @baton-dx/ai-tool-paths@1.0.0-alpha.12

## 1.0.0-alpha.11

### Patch Changes

- @baton-dx/ai-tool-paths@1.0.0-alpha.11

## 1.0.0-alpha.10

### Patch Changes

- @baton-dx/ai-tool-paths@1.0.0-alpha.10

## 1.0.0-alpha.9

### Patch Changes

- fd7f54b: Strict expression syntax: uppercase-only operators (AND, OR, NOT, IN) and new IN operator for set membership

  **Breaking:** Expression conditions now require uppercase operators only. Lowercase (`and`, `or`, `not`) and symbol aliases (`&&`, `||`, `!`) are no longer accepted — they produce parse errors. Use `AND`, `OR`, `NOT` instead.

  **New:** `IN` and `NOT IN` operators for concise multi-value matching:

  - `tool IN ['claude-code', 'cursor', 'windsurf']`
  - `tool NOT IN ['aider', 'codex']`
  - @baton-dx/ai-tool-paths@1.0.0-alpha.9

## 1.0.0-alpha.8

### Patch Changes

- f4f5292: Make expression condition operators case-insensitive — uppercase `OR`, `AND`, `NOT` (and mixed-case variants) now tokenize correctly instead of silently failing open
  - @baton-dx/ai-tool-paths@1.0.0-alpha.8

## 1.0.0-alpha.7

### Patch Changes

- @baton-dx/ai-tool-paths@1.0.0-alpha.7

## 1.0.0-alpha.6

### Patch Changes

- @baton-dx/ai-tool-paths@1.0.0-alpha.6

## 1.0.0-alpha.5

### Patch Changes

- @baton-dx/ai-tool-paths@1.0.0-alpha.5

## 1.0.0-alpha.4

### Patch Changes

- @baton-dx/ai-tool-paths@1.0.0-alpha.4

## 1.0.0-alpha.3

### Patch Changes

- @baton-dx/ai-tool-paths@1.0.0-alpha.3

## 1.0.0-alpha.2

### Patch Changes

- @baton-dx/ai-tool-paths@1.0.0-alpha.2
