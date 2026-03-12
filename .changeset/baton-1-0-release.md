---
"@baton-dx/cli": major
---

## Baton 1.0 — Convention-over-Configuration

Baton 1.0 replaces the manifest-based configuration model with a **convention-over-configuration** approach. Profile content is no longer declared in `baton.profile.yaml` — it is auto-discovered from the filesystem.

### Breaking Changes

**Profile manifests no longer declare content.** The following fields are removed from `baton.profile.yaml`:

`ai.rules`, `ai.skills`, `ai.agents`, `ai.memory`, `ai.commands`, `ai.mcp`, `files`, `ide`

Content is now placed in the profile directory by convention:

```
my-profile/
├── baton.profile.yaml        # metadata only
├── ai/
│   ├── rules/*.md
│   ├── agents/*.md
│   ├── skills/<name>/SKILL.md
│   ├── commands/*.md
│   ├── memory/MEMORY.md
│   └── mcp/*.yaml
├── files/
└── ide/<platform>/
```

**Source manifests no longer declare profiles.** The `profiles` field is removed from `baton.source.yaml`. Profiles are always auto-discovered from the `profiles/` directory.

**Merge strategies simplified from 8 to 2.** Only `concat` (default) and `replace` are supported. Set via frontmatter:

```markdown
---
merge: replace
---
```

Removed strategies: `deep`, `append`, `prepend`, `skip`, `prompt`, `directory`, `import`

**`baton update` command removed.** Use `baton sync` instead.

---

### New Features

**`baton preview`** — inspect processed output per AI tool before syncing:

```bash
baton preview --tool claude-code
baton preview --tool cursor --type rules
baton preview --tool claude-code --diff cursor
```

**`baton:else` directive:**

```markdown
<!-- baton:if tool="claude-code" -->
Claude-specific content.
<!-- baton:else -->
Content for all other tools.
<!-- baton:endif -->
```

**Expression-based conditions:**

```markdown
<!-- baton:if expr="tool('claude-code') AND scope('project')" -->
```

Supported operators: `AND`, `OR`, `NOT`, parentheses. Condition types: `tool`, `ide`, `scope`, `type`, `file`, `has`, `variable`

**Code block awareness** — directives inside fenced code blocks are ignored.

**Explain mode** — `baton preview` shows directive evaluation results for debugging.

---

### Migration

See [docs/MIGRATION-1.0.md](https://github.com/baton-dx/baton-dx/blob/main/docs/MIGRATION-1.0.md) for a full upgrade guide.
