---
"@baton-dx/core": minor
---

Strict expression syntax: uppercase-only operators (AND, OR, NOT, IN) and new IN operator for set membership

**Breaking:** Expression conditions now require uppercase operators only. Lowercase (`and`, `or`, `not`) and symbol aliases (`&&`, `||`, `!`) are no longer accepted — they produce parse errors. Use `AND`, `OR`, `NOT` instead.

**New:** `IN` and `NOT IN` operators for concise multi-value matching:
- `tool IN ['claude-code', 'cursor', 'windsurf']`
- `tool NOT IN ['aider', 'codex']`
