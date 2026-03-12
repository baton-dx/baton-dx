# Migrating to Baton 1.0

## Who needs to migrate?

Three roles may be affected:
1. **Source authors** — maintain `baton.source.yaml` and profile directories
2. **Profile authors** — maintain `baton.profile.yaml` and content files
3. **Project consumers** — use `baton.yaml` and run `baton sync`

---

## Source authors

### profiles field removed

Before (0.x):
```yaml
# baton.source.yaml
profiles:
  - name: default
    path: profiles/default
  - name: frontend
    path: profiles/frontend
```

After (1.0):
```yaml
# baton.source.yaml — profiles field removed
# Profiles are auto-discovered from the profiles/ directory
```

**Action:** Remove the `profiles` field. Ensure each profile directory contains `baton.profile.yaml`.

---

## Profile authors

### Content declarations removed from manifest

Before (0.x):
```yaml
# baton.profile.yaml
ai:
  rules:
    - coding-standards
    - security-guidelines
  skills:
    - name: deploy
  agents:
    - code-reviewer
  memory:
    - source: MEMORY.md
      merge: append
  commands:
    - build
  mcp:
    - name: github
      command: npx
      args: ["-y", "@modelcontextprotocol/server-github"]
files:
  - source: biome.json
ide:
  vscode:
    - settings.json
```

After (1.0):
```yaml
# baton.profile.yaml — only metadata + AI tool targeting
name: my-profile
version: 1.0.0
ai:
  tools: ["*"]
```

Content is placed in the filesystem:
```
my-profile/
├── baton.profile.yaml
├── ai/
│   ├── rules/coding-standards.md
│   ├── rules/security-guidelines.md
│   ├── skills/deploy/SKILL.md
│   ├── agents/code-reviewer.md
│   ├── memory/MEMORY.md
│   ├── commands/build.md
│   └── mcp/github.yaml
├── files/
│   └── biome.json
└── ide/
    └── vscode/
        └── settings.json
```

### Merge strategies simplified

| 0.x strategy | 1.0 equivalent |
|---|---|
| `append` | `concat` (default) |
| `prepend` | `concat` (default, reorder content) |
| `deep` | Not supported — use separate files |
| `skip` | Not supported — remove or use `replace` |
| `prompt` | Not supported |
| `directory` | Implicit for skills |
| `import` | Use `baton:include` directive |
| `replace` | `replace` (unchanged) |

Set merge strategy via frontmatter in content files:
```markdown
---
merge: replace
---
Your content here
```

### Per-tool targeting via directives

Before (0.x):
```yaml
ai:
  rules:
    claude-code:
      - coding-standards
    cursor:
      - cursor-conventions
```

After (1.0): Use `baton:if` directives inside a single rule file:
```markdown
<!-- baton:if tool="claude-code" -->
Claude-specific instructions here.
<!-- baton:else -->
Instructions for other tools.
<!-- baton:endif -->
```

---

## Project consumers

### baton.yaml — no changes required

The project manifest (`baton.yaml`) is unchanged. Run `baton sync` as before.

### baton update → baton sync

The `baton update` command has been removed. Use `baton sync` instead.

---

## New features in 1.0

### baton preview

Inspect processed output per AI tool:
```bash
baton preview --tool claude-code
baton preview --tool cursor --type rules
baton preview --tool claude-code --diff cursor
```

### Expression-based conditions

```markdown
<!-- baton:if expr="tool('claude-code') AND scope('project')" -->
...
<!-- baton:endif -->
```

### baton:else directive

```markdown
<!-- baton:if tool="claude-code" -->
Claude-specific content.
<!-- baton:else -->
Content for all other tools.
<!-- baton:endif -->
```

### Condition types

`tool`, `ide`, `scope`, `type`, `file`, `has`, `variable`
