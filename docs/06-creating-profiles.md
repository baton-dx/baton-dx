# Creating Profiles

Profiles live inside source repositories and are the primary unit of reuse in Baton. A single source can export multiple profiles (e.g. `frontend`, `backend`, `data-science`), and a project can compose several profiles together. For how to consume profiles, see [Using Profiles](./04-using-profiles.md).

Baton uses **convention over configuration**: you drop files into the right directories and they are automatically discovered at sync time. The manifest is minimal — you only declare things that can't be inferred from the filesystem.

---

## Creating a Profile

Use the `baton profile create` command from inside the source directory:

```bash
baton profile create my-profile
```

This scaffolds the directory layout and a starter `baton.profile.yaml`. You can also create the files manually — see [Directory Structure](#directory-structure) below.

---

## Profile Manifest (`baton.profile.yaml`)

The manifest declares identity and options. Content is auto-discovered from the directory structure.

### Minimal Example

```yaml
name: frontend
version: 1.0.0
```

### Full Example

```yaml
name: frontend
version: 1.0.0
description: Frontend development standards
extends: ../base
weight: 10
scope: project
ai:
  tools: [claude-code, cursor, windsurf]
variables:
  project_type: frontend
  framework: react
hooks:
  post-install: "npm install"
  post-update: "npm install"
```

### Field Reference

| Field         | Type    | Required | Default | Description                                                      |
| ------------- | ------- | -------- | ------- | ---------------------------------------------------------------- |
| `name`        | string  | yes      | —       | Unique identifier for the profile within its source.             |
| `version`     | string  | no       | —       | Semver version of the profile.                                   |
| `description` | string  | no       | —       | Human-readable description.                                      |
| `extends`     | string  | no       | —       | Sibling profile name to inherit from (e.g. `../base`).           |
| `weight`      | number  | no       | `0`     | Priority ordering for multi-profile layering (-1 to infinity).   |
| `scope`       | string  | no       | —       | Default scope for all content (`project` or `global`).           |
| `ai.tools`    | string[]| no       | all     | AI tools this profile targets.                                   |
| `variables`   | object  | no       | `{}`    | Key-value pairs for template substitution.                       |
| `hooks`       | object  | no       | —       | Lifecycle hooks. Supported keys: `post-install`, `post-update`. Value is a shell command string. |

Everything else — skills, rules, agents, memory, commands, files, IDE settings — is discovered automatically from the directory layout.

---

## Directory Structure

Content is organized into conventional directories. Baton discovers everything at sync time — no manifest declarations needed.

```
frontend/
├── baton.profile.yaml
├── ai/
│   ├── memory/
│   │   └── MEMORY.md          # single memory file for the profile
│   ├── rules/
│   │   ├── coding-style.md    # rule for all targeted tools
│   │   └── testing.md
│   ├── agents/
│   │   └── reviewer.md        # agent with YAML frontmatter
│   ├── skills/
│   │   ├── code-review/
│   │   │   └── SKILL.md
│   │   └── refactor/
│   │       └── SKILL.md
│   ├── commands/
│   │   └── deploy.md
│   └── mcp/
│       └── filesystem.yaml    # MCP server definition
├── files/
│   ├── .editorconfig
│   └── biome.json
└── ide/
    └── vscode/
        ├── settings.json
        └── extensions.json
```

### Content Directory Reference

| Directory        | What Baton discovers                                                 |
| ---------------- | -------------------------------------------------------------------- |
| `ai/memory/`     | `MEMORY.md` — one memory file per profile                           |
| `ai/rules/`      | `*.md` — flat rule files, placed for all targeted tools             |
| `ai/agents/`     | `*.md` — agent files with YAML frontmatter                          |
| `ai/skills/`     | `*/SKILL.md` — skill directories                                    |
| `ai/commands/`   | `*.md` — command files                                              |
| `ai/mcp/`        | `*.yaml` — MCP server configuration files                          |
| `files/`         | `**/*` — arbitrary files placed in the project root                 |
| `ide/{platform}/`| `**/*` — IDE-specific files (e.g. `ide/vscode/settings.json`)      |

Files whose name starts with `_` are excluded. This is the convention for drafts and disabled content — rename `_wip-rule.md` to `wip-rule.md` when ready.

---

## Content File Conventions

### Memory (`ai/memory/MEMORY.md`)

A single Markdown file that provides persistent context across AI sessions. By default it is concatenated with memory from other installed profiles. Use the `merge: replace` frontmatter key to overwrite instead:

```markdown
---
merge: replace
---

# Project Context

This project uses React 19 with TypeScript strict mode.
```

### Rules (`ai/rules/*.md`)

Flat Markdown files. Each file becomes a rule placed for all targeted AI tools.

```markdown
# Coding Style

- Use TypeScript strict mode
- Prefer named exports over default exports
- Write JSDoc for public APIs
```

Use `baton:if` directives to include tool-specific sections within a single rule file rather than creating separate files per tool.

### Agents (`ai/agents/*.md`)

Markdown files with YAML frontmatter. The frontmatter defines the agent's metadata; the body is the agent's system prompt.

```markdown
---
name: reviewer
description: Code review specialist
---

You are a code review specialist. Focus on:
- Code quality and readability
- Performance implications
- Security vulnerabilities
- Test coverage
```

### Skills (`ai/skills/*/SKILL.md`)

Each skill is a directory containing a `SKILL.md` file. The directory name is the skill name.

```
ai/skills/
├── code-review/
│   └── SKILL.md
└── refactor/
    └── SKILL.md
```

### Commands (`ai/commands/*.md`)

Markdown files that define executable slash-commands for AI tools that support them (Claude Code, Cursor, etc.).

### MCP Servers (`ai/mcp/*.yaml`)

YAML files that define MCP server configurations. Each file declares one server. The filename (without extension) is the server name.

```yaml
# ai/mcp/filesystem.yaml
transport: stdio
command: npx
args: ["-y", "@modelcontextprotocol/server-filesystem"]
env:
  ROOT_DIR: "${HOME}"
scope: project
```

| Field       | Type     | Required | Description                                                                   |
| ----------- | -------- | -------- | ----------------------------------------------------------------------------- |
| `transport` | string   | yes      | `stdio`, `http`, or `sse`                                                     |
| `command`   | string   | no       | Executable command (required for `stdio`)                                     |
| `args`      | string[] | no       | Arguments passed to the command                                               |
| `env`       | object   | no       | Environment variables. Use `${VAR}` or `${VAR:-default}` syntax.             |
| `url`       | string   | no       | Server URL (required for `http` and `sse`)                                   |
| `headers`   | object   | no       | HTTP headers (for `http`/`sse` transports)                                   |
| `scope`     | string   | no       | `project` or `global`. Defaults to `project`.                                |
| `tools`     | string[] | no       | Restrict to specific tool keys. Omit to target all installed tools.          |

### Files (`files/**`)

Any file under `files/` is placed into the project root, preserving the relative path. `files/biome.json` → `biome.json` in the project.

Use the `merge` frontmatter key in a sidecar `.baton.yaml` file, or use the default behavior: `concat` for text files, `replace` for binary files.

### IDE Settings (`ide/{platform}/**`)

Files under `ide/vscode/` are placed into the project's `.vscode/` directory.

```
ide/
└── vscode/
    ├── settings.json      # → .vscode/settings.json
    └── extensions.json    # → .vscode/extensions.json
```

---

## Frontmatter Keys

Baton reserves two frontmatter keys in content files. They are stripped at sync time and never appear in the placed output.

| Key     | Values                | Where supported                       | Description                           |
| ------- | --------------------- | ------------------------------------- | ------------------------------------- |
| `merge` | `concat` \| `replace` | `ai/memory/MEMORY.md`, `files/**`    | How to merge with existing content.   |
| `scope` | `project` \| `global` | `ai/rules/*.md`, `ai/agents/*.md`, `ai/commands/*.md`, `ai/skills/*/SKILL.md` | Override the profile-level default scope. |

**`merge: concat`** (default) — content is appended to existing content with a separator.
**`merge: replace`** — existing content is completely replaced.

**`scope: project`** — placed in the project directory.
**`scope: global`** — placed in the home directory (global AI tool config).

---

## Directives

Directives are HTML comments with a `baton:` prefix that Baton processes at sync time. They let you conditionally include content or pull in external files — all without breaking Markdown rendering.

Directives work in **all content types**: skills, rules, agents, memory, and commands.

### Conditional Content (`baton:if`)

Show or hide content based on the current tool, IDE, scope, or content type. This is the primary mechanism for per-tool targeting — no separate files needed.

```markdown
<!-- baton:if tool="claude-code" -->
Claude-specific instructions here.
<!-- baton:endif -->

<!-- baton:if not-tool="cursor" -->
This appears for every tool except Cursor.
<!-- baton:endif -->

<!-- baton:if ide="vscode" -->
VS Code tips here.
<!-- baton:endif -->

<!-- baton:if scope="project" -->
Project-scoped content only.
<!-- baton:endif -->

<!-- baton:if type="memory" -->
Only when placed as memory content.
<!-- baton:endif -->
```

#### Else Branches

Use `baton:else` for fallback content when a condition is false:

```markdown
<!-- baton:if tool="claude-code" -->
Use @file to reference project files.
<!-- baton:else -->
Reference files by relative path.
<!-- baton:endif -->
```

The if-branch is kept when the condition matches; otherwise the else-branch is kept. Only one `baton:else` is allowed per `baton:if` block.

#### OR and AND Composition

**OR within an attribute** — comma-separated values match any:

```markdown
<!-- baton:if tool="cursor,windsurf" -->
Web IDE content.
<!-- baton:endif -->
```

**AND across attributes** — all attributes must match:

```markdown
<!-- baton:if tool="claude-code" scope="project" -->
Claude Code project-only content.
<!-- baton:endif -->
```

#### Nesting

Conditionals can be nested (up to 5 levels):

```markdown
<!-- baton:if tool="claude-code" -->
<!-- baton:if scope="project" -->
Claude Code project-specific content.
<!-- baton:endif -->
<!-- baton:endif -->
```

Nesting also works inside else branches:

```markdown
<!-- baton:if tool="cursor" -->
Cursor instructions.
<!-- baton:else -->
<!-- baton:if scope="project" -->
Project fallback for non-Cursor tools.
<!-- baton:endif -->
<!-- baton:endif -->
```

**Fail-open behavior:** If a `baton:if` has no matching `baton:endif`, the content is kept and a warning is emitted. This prevents accidental data loss from typos.

| Attribute    | Description                                                          |
| ------------ | -------------------------------------------------------------------- |
| `tool`       | Match a specific AI tool key (e.g. `claude-code`, `cursor`)         |
| `not-tool`   | Match all tools *except* this one                                    |
| `ide`        | Match a specific IDE platform (e.g. `vscode`)                       |
| `scope`      | Match placement scope: `project` or `global`                        |
| `type`       | Match content type: `memory`, `rules`, `agents`, `skills`, `commands` |
| `file`       | Match when a file exists in the target project (e.g. `file="tsconfig.json"`) |
| `not-file`   | Match when a file does *not* exist in the target project             |
| `var`        | Match when a variable is defined (e.g. `var="framework"`)           |
| `not-var`    | Match when a variable is *not* defined                               |
| `has`        | Match a project trait detected by Baton (e.g. `has="typescript"`, `has="react"`) |
| `not-has`    | Match when a trait is *not* detected                                 |
| `condition`  | Expression-based condition (see below)                               |

#### Expression-Based Conditions

For complex conditions, use the `condition` attribute with a readable expression language:

```markdown
<!-- baton:if condition="tool == 'claude-code'" -->
<!-- baton:if condition="tool != 'cursor'" -->
<!-- baton:if condition="tool == 'cursor' or tool == 'windsurf'" -->
<!-- baton:if condition="scope == 'project' and type == 'memory'" -->
<!-- baton:if condition="has('typescript') and not has('prettier')" -->
<!-- baton:if condition="file('biome.json') or file('biome.jsonc')" -->
<!-- baton:if condition="var('lang') == 'typescript'" -->
<!-- baton:if condition="var('lang')" -->
<!-- baton:if condition="(tool == 'claude-code' or tool == 'cursor') and scope == 'project'" -->
```

Expression conditions support:

| Element | Syntax | Description |
|---------|--------|-------------|
| Properties | `tool`, `scope`, `type`, `ide` | Compare with `==` or `!=` |
| Functions | `has('key')`, `file('path')`, `var('name')` | Lookup checks, return boolean |
| Function + compare | `var('name') == 'value'` | Check function result against value |
| AND | `and` or `&&` | Both sides must be true |
| OR | `or` or `\|\|` | Either side must be true |
| NOT | `not` or `!` | Negates the following expression |
| Grouping | `(...)` | Override default precedence |

**Operator precedence:** `not` > `and` > `or` (standard). Use parentheses to override.

**String values** use single quotes inside the double-quoted attribute: `condition="tool == 'claude-code'"`.

Expression conditions also work with `baton:else`:

```markdown
<!-- baton:if condition="tool == 'claude-code' or tool == 'cursor'" -->
Use AI-native file references.
<!-- baton:else -->
Use standard file paths.
<!-- baton:endif -->
```

When `condition` is present alongside old-style attributes (e.g. `tool="..."`), the `condition` takes precedence and a warning is emitted. Old-style attributes remain fully supported.

### File Inclusion (`baton:include`)

Include external files by reference or inline their content:

```markdown
<!-- baton:include src="PROJECT.md" -->
<!-- baton:include src="docs/api.md" mode="inline" -->
<!-- baton:include src="docs/api.md" mode="link" -->
<!-- baton:include src="docs/api.md" mode="link" hint="API Docs: {{file}}" -->
<!-- baton:include src="docs/api.md" mode="reference" -->
<!-- baton:include src="docs/OPTIONAL.md" optional="true" -->
```

| Attribute  | Required | Default  | Description                                                           |
| ---------- | -------- | -------- | --------------------------------------------------------------------- |
| `src`      | yes      | —        | Path relative to the profile source (or project root with `@project/`) |
| `mode`     | no       | `inline` | How to include the file (see below)                                  |
| `hint`     | no       | —        | Template for `link`/`reference` output. Use `{{file}}` as placeholder. |
| `optional` | no       | `false`  | `true` = silently skip if the file doesn't exist                     |

#### Resolution Roots

By default, `baton:include` resolves paths relative to the **profile source** directory. Use the `@project/` prefix to resolve relative to the **target project**:

| Prefix | Resolves relative to | `optional` default | Use case |
|--------|---------------------|-------------------|----------|
| *(none)* | Profile source | `false` | Fragments bundled with the profile |
| `@project/` | Target project root | `true` | Project-specific context (e.g., PROJECT.md) |

#### Include Modes

| Mode        | Output (without hint)                       |
| ----------- | ------------------------------------------- |
| `inline`    | File content inlined verbatim               |
| `link`      | `[docs/api.md](docs/api.md)`               |
| `reference` | `See @docs/api.md for additional context.` |

### Combining Directives

Conditionals and includes work together. Includes inside excluded conditionals are never read:

```markdown
<!-- baton:if tool="claude-code" -->
<!-- baton:include src="docs/claude-specific.md" -->
<!-- baton:endif -->

<!-- baton:if tool="cursor" -->
<!-- baton:include src="docs/cursor-tips.md" mode="link" hint="See {{file}}" -->
<!-- baton:endif -->
```

### Recommended: ROOT + Fragments Pattern

Structure your profile content as a ROOT file that composes fragments via directives:

```
profile/ai/memory/
├── MEMORY.md              ← ROOT (listed in baton.profile.yaml)
└── fragments/
    ├── typescript.md
    ├── react-patterns.md
    └── biome-config.md
```

The ROOT file uses directives to build the final content dynamically:

```markdown
# Team Standards

<!-- baton:include src="ai/memory/fragments/typescript.md" -->

<!-- baton:if has="react" -->
<!-- baton:include src="ai/memory/fragments/react-patterns.md" -->
<!-- baton:endif -->

<!-- baton:include src="@project/PROJECT.md" -->
```

This pattern works for memory, skills (SKILL.md + fragments/), and agents.

### Shared Fragments Across Multiple Files

When a fragment is needed in more than one file — for example, the same tech stack context in `MEMORY.md` and in a `SKILL.md` — put it in `ai/shared/` and use `mode="reference"`:

```
profile/
└── ai/
    ├── shared/
    │   └── tech-stack.md        ← one file, referenced from multiple places
    ├── memory/
    │   └── MEMORY.md
    └── skills/
        ├── commit/
        │   └── SKILL.md
        └── review/
            └── SKILL.md
```

```markdown
<!-- in MEMORY.md -->
<!-- baton:include src="ai/shared/tech-stack.md" mode="reference" -->

<!-- in skills/commit/SKILL.md -->
<!-- baton:include src="ai/shared/tech-stack.md" mode="reference" -->
```

With `mode="reference"`, Baton copies `tech-stack.md` to `.baton/includes/<profileName>/ai/shared/tech-stack.md` in the target project and replaces the directive with `@.baton/includes/...`. Even if the same file is referenced ten times, it is only copied once.

Use `mode="inline"` instead when the fragment is small and only used in one place — inlining avoids the extra file and is simpler to reason about.

---

## Inheritance

Profiles can extend a sibling profile using the `extends` field. This allows you to define a base profile with shared configuration and have specialized profiles build on top of it.

```yaml
# profiles/frontend/baton.profile.yaml
name: frontend
extends: ../base
weight: 10
```

The `extends` field accepts a single relative path pointing to a sibling profile directory. When a profile extends another:

1. The parent profile's content directories are merged with the child's.
2. Child content takes precedence when names conflict.
3. The child's manifest fields override the parent's.

This is useful for creating a hierarchy like:

```
profiles/
├── base/              # shared rules, common memory
│   └── baton.profile.yaml
├── frontend/          # extends base, adds frontend-specific content
│   └── baton.profile.yaml
└── backend/           # extends base, adds backend-specific content
    └── baton.profile.yaml
```

> **Real-world example:** Baton's own [`baton-dx-source`](https://github.com/baton-dx/baton-dx-source) uses this pattern. A `base` profile (weight 0) contains shared Baton knowledge. Three specialized profiles — `maintainer`, `creator`, and `consumer` — each extend `base` and add audience-specific content.

---

## Weight

The `weight` field controls priority when multiple profiles are applied to the same project. Profiles with a higher weight take precedence during merge conflicts.

```yaml
weight: 10
```

| Value | Meaning                                                     |
| ----- | ----------------------------------------------------------- |
| `-1`  | Lowest priority. Applied first, easily overridden.          |
| `0`   | Default weight. Standard priority.                          |
| `10`  | Higher priority. Overrides profiles with lower weight.      |
| `100` | Very high priority. Use for critical, non-negotiable rules. |

---

## Variables and Substitution

Profiles can declare variables that are substituted into templates at sync time.

```yaml
variables:
  project_type: frontend
  framework: react
  node_version: "20"
```

Use `{{variable_name}}` syntax in any Markdown or configuration file within the profile:

```markdown
# Project Standards

This is a {{project_type}} project using {{framework}}.
Minimum Node.js version: {{node_version}}.
```

Variables can be overridden by the consuming project in its `baton.yaml`:

```yaml
variables:
  framework: vue
```

---

## Hooks

Hooks allow you to run commands at specific points during the sync lifecycle.

```yaml
hooks:
  post-install: "npm install"
  post-update: "npm install"
```

| Hook            | When it runs                                      |
| --------------- | ------------------------------------------------- |
| `post-install`  | After the profile is installed for the first time. |
| `post-update`   | After the profile is updated.                     |

Each hook value is a shell command string that runs when the event fires. If the command fails, an error is reported.

---

## Migration: From Pre-1.0 Manifest-Based to 1.0 Convention-Based

If you have an existing profile using pre-1.0 manifest-based declarations, here is how to migrate.

### Before (pre-1.0 — explicit declarations)

```yaml
# baton.profile.yaml
name: frontend
version: 0.9.0
ai:
  tools: [claude-code, cursor]
  skills:
    - name: code-review
      scope: project
  rules:
    - name: coding-style
      scope: project
  agents:
    - name: reviewer
  memory:
    - source: MEMORY.md
      merge: append
  commands:
    - name: deploy
files:
  - source: files/biome.json
    target: biome.json
    merge: replace
ide:
  vscode:
    settings: ide/vscode/settings.json
```

### After (1.0 — convention-based)

```yaml
# baton.profile.yaml — just identity and options
name: frontend
version: 1.0.0
ai:
  tools: [claude-code, cursor]
```

The directory structure is identical — no files need to move. Baton 1.0 discovers them automatically. Remove the `ai.skills`, `ai.rules`, `ai.memory`, `ai.commands`, `ai.agents`, `files`, and `ide` blocks from the manifest. Also remove any `merge: append`, `merge: deep`, or other legacy merge strategy references — only `concat` (default) and `replace` are supported.

To set a non-default merge strategy on your memory file, add frontmatter to `ai/memory/MEMORY.md`:

```markdown
---
merge: replace
---

# Memory content here
```

To set a non-default scope on a rule, add frontmatter to the rule file:

```markdown
---
scope: global
---

# Rule content here
```

---

## Next Steps

- [Using Profiles](./04-using-profiles.md) — learn how to consume profiles in your projects.
- [Creating Sources](./05-creating-sources.md) — learn how to package profiles into distributable sources.
