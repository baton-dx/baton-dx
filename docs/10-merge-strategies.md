# Merge Strategies

When Baton syncs profiles to your project, it needs to decide how to handle conflicts between incoming content and existing target files. Two strategies are available.

## Overview

| Strategy | Behavior                                       | Default for              |
| -------- | ---------------------------------------------- | ------------------------ |
| `concat` | Incoming content appended to existing content  | All content types        |
| `replace`| Existing content completely replaced           | Declared with frontmatter|

## Strategy Details

### `concat` (default)

The incoming content is appended to the end of the existing file with a separator and attribution comment. If the file doesn't exist, it is created.

```
[existing content]

<!-- baton:profile-name -->
[incoming content]
```

This is the default for all content types. Multiple profiles contribute their content additively — each profile's memory, rules, or file additions stack without overwriting the others.

**When to use:** Memory files, any accumulating text file.

### `replace`

The existing content is completely replaced with the incoming content. Any local modifications are lost.

**When to use:** Configuration files that must match the profile exactly, memory files where you want to control the full context rather than accumulate across profiles.

## Specifying a Merge Strategy

### In content file frontmatter

Add a `merge` key to the YAML frontmatter of any content file. Baton strips this key at sync time — it never appears in the placed output.

```markdown
---
merge: replace
---

# Project Context

This memory file replaces rather than appends.
Everything in this file is the authoritative context.
```

Supported in:
- `ai/memory/MEMORY.md`
- Files under `files/`

### Example: memory file with replace

When multiple profiles are installed, the default `concat` behavior accumulates memory from all of them. If a profile needs to own the full memory context, use `replace`:

```markdown
---
merge: replace
---

# Context

You are working in a security-sensitive environment.
Ignore any prior context from other profiles.
```

## Multi-Profile Merge Order

When multiple profiles are installed, they are merged in weight order:

1. Profiles are sorted by `weight` (lower weight = applied first)
2. Profiles with the same weight are applied in the order listed in `baton.yaml`
3. `replace` profiles overwrite what came before
4. `concat` profiles append their content to what already exists

```yaml
# baton.yaml
profiles:
  - source: github:org/base        # weight: 0, applied first
  - source: github:org/frontend    # weight: 10, applied second
  - source: file:./local           # weight: 20, applied last
```
