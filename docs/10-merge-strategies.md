# Merge Strategies

When Baton syncs profiles to your project, it needs to decide how to handle conflicts between source files and existing target files. Merge strategies control this behavior.

## Overview

| Strategy | Behavior | Use Case |
|----------|----------|----------|
| `replace` | Target completely replaced with source | Config files that should match the profile exactly |
| `deep` | JSON/YAML objects deep-merged | `settings.json`, `biome.json` — merge keys, don't overwrite entire file |
| `append` | Source content appended to end of target | Memory files, `.gitignore` — add new entries |
| `prepend` | Source content prepended to start of target | Files where new content should come first |
| `skip` | Only write if target doesn't exist | Files users are expected to customize (`.env.example`) |
| `prompt` | Ask user interactively | Sensitive files where the user should decide |
| `directory` | Directory-level merge | Skill directories — add new files, overwrite existing |
| `import` | Add `@import` reference line | CSS/SCSS files — add import statement |

## Strategy Details

### `replace`

The target file is completely replaced with the source content. Any local modifications are lost.

```yaml
files:
  - source: files/.editorconfig
    target: .editorconfig
    merge: replace
```

**When to use:** For files that should always match the profile exactly (`.editorconfig`, lint configs).

### `deep`

For JSON and YAML files. Source keys are deep-merged into the target. Source keys override target keys at each level, but target keys not present in the source are preserved.

```yaml
files:
  - source: files/biome.json
    target: biome.json
    merge: deep
```

**Example:**

```
Target:                    Source:                    Result:
{                          {                          {
  "linter": {                "linter": {                "linter": {
    "enabled": true,           "rules": {                 "enabled": true,
    "rules": {}                  "style": "error"           "rules": {
  },                           }                              "style": "error"
  "custom": "keep"           }                              }
}                          }                            },
                                                        "custom": "keep"
                                                      }
```

**When to use:** Settings files, package.json-style configs, any structured data where you want additive merging.

### `append`

Source content is appended to the end of the target file with a separator line and attribution comment.

```yaml
ai:
  memory:
    - source: MEMORY.md
      merge: append
```

**Result:**
```
[existing target content]

<!-- baton:profile-name -->
[source content]
```

**When to use:** Memory files (`MEMORY.md`), `.gitignore`, any text file where content should accumulate.

### `prepend`

Source content is prepended to the start of the target file.

```yaml
files:
  - source: files/header.md
    target: README.md
    merge: prepend
```

**When to use:** Files where profile content should appear before existing content.

### `skip`

Source is only written if the target file does not exist. If the target already exists, it's left untouched.

```yaml
files:
  - source: files/.env.example
    target: .env.example
    merge: skip
```

**When to use:** Template files users are expected to customize, initial scaffolding files.

### `prompt`

In interactive mode, the user is asked what to do: replace, skip, or view a diff. In non-interactive mode (`--yes`), falls back to `replace`.

```yaml
files:
  - source: files/tsconfig.json
    target: tsconfig.json
    merge: prompt
```

**When to use:** Sensitive configuration files where the user should review changes.

### `directory`

For directory-based merging (primarily used by skills). New files from the source are added, existing files are overwritten.

```yaml
ai:
  skills:
    - name: code-review
      scope: project
```

**When to use:** Skill directories, any directory that should be mirrored from the profile.

### `import`

Adds an `@import` reference line to the target file, pointing to the source file. The source file is placed alongside the target.

```yaml
files:
  - source: files/theme.css
    target: styles/main.css
    merge: import
```

**Result in `main.css`:**
```css
@import './theme.css';
/* existing content */
```

**When to use:** CSS/SCSS files, any format that supports `@import`.

## Specifying Merge Strategies

### In Profile Manifests

```yaml
# baton.profile.yaml
files:
  - source: files/.editorconfig
    target: .editorconfig
    merge: replace

ai:
  memory:
    - source: MEMORY.md
      merge: append
```

### In Project Overrides

Override the profile's merge strategy in `baton.yaml`:

```yaml
# baton.yaml
overrides:
  files:
    .gitignore:
      merge: skip        # Don't touch my .gitignore
    biome.json:
      merge: replace     # Use profile's biome.json exactly
```

## Multi-Profile Merge Order

When multiple profiles are installed, they're merged in order:

1. Profiles are sorted by `weight` (lower weight = applied first)
2. Profiles with the same weight are applied in the order listed in `baton.yaml`
3. Later profiles override earlier ones (for `replace` and `deep`)
4. For `append`/`prepend`, content accumulates from all profiles

```yaml
# baton.yaml
profiles:
  - source: github:org/base        # weight: 0, applied first
  - source: github:org/frontend    # weight: 10, applied second
  - source: file:./local           # weight: 20, applied last (wins conflicts)
```
