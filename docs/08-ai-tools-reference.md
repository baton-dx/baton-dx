# AI Tools Reference

Baton supports 14 AI coding tools with specialized adapters. Each adapter transforms canonical profile data into the format expected by the specific tool.

## Supported Tools

| Tool | Key | Config Dir | Memory File | Rule Format |
|------|-----|-----------|-------------|-------------|
| Claude Code | `claude-code` | `.claude/` | `CLAUDE.md` | Markdown |
| Cursor | `cursor` | `.cursor/` | `AGENTS.md` | `.mdc` (frontmatter) |
| Windsurf | `windsurf` | `.windsurf/` | `AGENTS.md` | Markdown (no frontmatter) |
| Antigravity | `antigravity` | `.agent/` | `GEMINI.md` | Markdown |
| Codex CLI | `codex` | `.codex/` | `AGENTS.md` | Markdown |
| GitHub Copilot | `github-copilot` | `.github/` | `copilot-instructions.md` | Markdown |
| OpenCode | `opencode` | `.opencode/` | `AGENTS.md` | Markdown |
| Amp | `amp` | `.agents/` | `AGENTS.md` | Markdown |
| Kiro | `kiro` | `.kiro/` | `AGENTS.md` | Markdown |
| Zed | `zed` | `.zed/` | `AGENTS.md` | Markdown |
| Cline | `cline` | `.cline/` | `AGENTS.md` | Markdown |
| Roo | `roo` | `.roo/` | `AGENTS.md` | Markdown |
| Junie | `junie` | `.junie/` | `AGENTS.md` | Markdown |
| Trae | `trae` | `.trae/` | `AGENTS.md` | Markdown |

## Detection

Baton detects installed tools by checking for:

1. **CLI binary** in `PATH` (e.g., `claude`, `cursor`, `code`)
2. **Config directory** existence (e.g., `~/.claude/`, `~/.cursor/`)

Run `baton ai-tools scan` to detect and save installed tools.

## Config Types

Each tool supports these config types:

| Type | Description | Example |
|------|-------------|---------|
| `skills` | Skill directories with `SKILL.md` | `.claude/skills/code-review/SKILL.md` |
| `rules` | Markdown rule files | `.claude/rules/coding-style.md` |
| `agents` | Agent files with YAML frontmatter | `.claude/agents/reviewer.md` |
| `memory` | Context memory files | `CLAUDE.md` |
| `settings` | Tool settings (JSON) | `.claude/settings.json` |
| `commands` | Slash command files | `.claude/commands/review.md` |

Each config type has both **project** scope (in the project directory) and **global** scope (in the user's home directory).

## Tool-Specific Behavior

### Claude Code

- **Memory file:** `CLAUDE.md` (project root)
- **Rules:** Standard Markdown with optional YAML frontmatter
- **Skills:** Directory-based with `SKILL.md`
- **Legacy paths:** None

### Cursor

- **Memory file:** `AGENTS.md` (project root)
- **Rules:** Transformed to `.mdc` format with `description`, `globs`, and `alwaysApply` frontmatter
- **Legacy paths:** `.cursorrules` (single rules file)
- **Note:** Rules without `paths` frontmatter get `alwaysApply: true`

### Windsurf

- **Memory file:** `AGENTS.md` (project root)
- **Rules:** YAML frontmatter is stripped — only plain Markdown content
- **Legacy paths:** `.windsurfrules` (single rules file)

### Antigravity

- **Memory file:** `GEMINI.md` (project root)
- **Config dir:** `.agent/` (not `.antigravity/`)

### GitHub Copilot

- **Memory file:** `copilot-instructions.md`
- **Config dir:** `.github/`
- **Note:** Instructions file lives in `.github/copilot-instructions.md`

### Codex CLI

- **Config dir:** `.codex/`
- **Settings:** TOML format

## Path Patterns

Config paths use placeholders that get resolved at runtime:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{name}` | Config item name | `code-review` |
| `~` | User home directory | `/Users/daniel` |

**Project scope example:** `.claude/skills/{name}` → `.claude/skills/code-review/`
**Global scope example:** `~/.claude/skills/{name}` → `~/.claude/skills/code-review/`

## Adapter Architecture

All adapters implement the `ToolAdapter` interface and most extend `BaseAdapter`:

```
ToolAdapter (interface)
  └── BaseAdapter (abstract class — provides defaults)
        ├── ClaudeCodeAdapter
        ├── CursorAdapter (overrides: transformRule, getLegacyPaths, validate)
        ├── WindsurfAdapter (overrides: transformRule, getLegacyPaths, validate)
        ├── AntigravityAdapter (overrides: memoryFilename)
        ├── GitHubCopilotAdapter (overrides: memoryFilename)
        └── ... (11 more adapters)
```

The `BaseAdapter` provides:
- `isInstalled()` — via `detectInstalledAgents()`
- `getPath()` — via `getAgentPath()` from `@baton-dx/agent-paths`
- `getLegacyPaths()` — returns `[]`
- `transform*()` — passthrough (return input unchanged)
- `transformMemory()` — converts `MEMORY.md` to tool-specific filename
- `validate()` — common type-specific validation
