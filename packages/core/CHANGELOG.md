# @baton-dx/core

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
