# @baton-dx/core

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
