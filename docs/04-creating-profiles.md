# Creating Profiles

A **profile** is a self-contained bundle of AI tool configurations, file placements, and IDE settings. Profiles live inside source repositories and are the primary unit of reuse in Baton. A single source can export multiple profiles (e.g. `frontend`, `backend`, `data-science`), and a project can compose several profiles together.

---

## What is a Profile

A profile answers the question: "What should a developer's AI tooling and project config look like for this kind of work?" It bundles:

- **AI configurations** -- skills, rules, agents, memory, commands
- **File placements** -- static config files like `.editorconfig`, `biome.json`, `.prettierrc`
- **IDE settings** -- editor-specific settings, extensions, and workspace configuration

Profiles are declared inside a source repository's `baton.source.yaml` and each profile has its own directory containing a `baton.profile.yaml` manifest.

---

## Profile Manifest (`baton.profile.yaml`)

The profile manifest is the central configuration file for a profile. It declares what the profile provides and how it should be applied.

### Full Example

```yaml
name: frontend
version: 1.0.0
description: Frontend development standards
extends:
  - ../base
weight: 10
ai:
  tools: [claude-code, cursor, windsurf]
  skills:
    - name: code-review
      scope: project
    - name: refactor
      scope: project
  rules:
    - name: coding-style
      scope: project
  memory:
    - source: MEMORY.md
      merge: append
  agents:
    - name: reviewer
      scope: project
files:
  - source: files/.editorconfig
    target: .editorconfig
    merge: replace
  - source: files/biome.json
    target: biome.json
    merge: deep
ide:
  vscode:
    settings: ide/vscode/settings.json
    extensions: ide/vscode/extensions.json
variables:
  project_type: frontend
  framework: react
```

### Field Reference

| Field         | Type     | Required | Default | Description                                                      |
| ------------- | -------- | -------- | ------- | ---------------------------------------------------------------- |
| `name`        | string   | yes      | --      | Unique identifier for the profile within its source.             |
| `version`     | string   | no       | --      | Semver version of the profile.                                   |
| `description` | string   | no       | --      | Human-readable description.                                      |
| `extends`     | string[] | no       | `[]`    | Paths to parent profiles for inheritance.                        |
| `weight`      | number   | no       | `0`     | Priority ordering for multi-profile layering (-1 to infinity).   |
| `ai`          | object   | no       | --      | AI tool configuration block.                                     |
| `files`       | array    | no       | `[]`    | File placement declarations.                                     |
| `ide`         | object   | no       | --      | IDE-specific settings.                                           |
| `variables`   | object   | no       | `{}`    | Key-value pairs for template substitution.                       |
| `hooks`       | object   | no       | --      | Lifecycle hooks (pre-sync, post-sync).                           |

---

## Directory Structure

Every profile follows a consistent directory layout:

```
frontend/
├── baton.profile.yaml
├── ai/
│   ├── skills/
│   │   ├── code-review/
│   │   │   └── SKILL.md
│   │   └── refactor/
│   │       └── SKILL.md
│   ├── rules/
│   │   ├── coding-style.md          # universal rule
│   │   ├── testing.md               # universal rule
│   │   └── cursor/                   # tool-specific rules
│   │       └── react-patterns.md
│   ├── agents/
│   │   └── reviewer.md
│   ├── memory/
│   │   └── MEMORY.md
│   └── commands/
│       └── deploy.md
├── files/
│   ├── .editorconfig
│   ├── biome.json
│   └── .prettierrc
└── ide/
    └── vscode/
        ├── settings.json
        └── extensions.json
```

### Rules: Universal vs. Tool-Specific

Rules placed directly in `ai/rules/` are **universal** -- they are applied to all targeted AI tools. Rules placed in a subdirectory named after a tool (e.g. `ai/rules/cursor/`) are **tool-specific** and only applied when that tool is a target.

```
ai/rules/
├── coding-style.md            # applied to all tools
├── testing.md                 # applied to all tools
├── cursor/
│   └── react-patterns.md     # only applied to Cursor
└── claude-code/
    └── project-context.md    # only applied to Claude Code
```

---

## AI Configuration

The `ai` block in `baton.profile.yaml` defines what AI configurations the profile provides and which tools they target.

### Supported Tools

Baton supports 14 AI tools:

`claude-code` | `cursor` | `windsurf` | `antigravity` | `codex` | `github-copilot` | `opencode` | `amp` | `kiro` | `zed` | `cline` | `roo` | `junie` | `trae`

### `ai.tools`

The `tools` array declares which AI tools this profile targets. When syncing, Baton only writes configurations for the tools that match the project's `ai.targets`.

```yaml
ai:
  tools: [claude-code, cursor, windsurf]
```

### Skills

Skills are directories containing a `SKILL.md` file. They represent reusable capabilities that an AI tool can invoke.

```yaml
ai:
  skills:
    - name: code-review
      scope: project
    - name: refactor
      scope: project
```

| Field   | Type   | Description                                              |
| ------- | ------ | -------------------------------------------------------- |
| `name`  | string | Skill name. Must match a directory under `ai/skills/`.   |
| `scope` | string | Where the skill is available (`project` or `global`).    |

Each skill directory must contain a `SKILL.md`:

```
ai/skills/code-review/
└── SKILL.md
```

The `SKILL.md` file contains the skill's instructions in Markdown format.

### Rules

Rules are Markdown files that provide instructions and guidelines to AI tools.

```yaml
ai:
  rules:
    - name: coding-style
      scope: project
    - name: testing
      scope: project
```

| Field   | Type   | Description                                          |
| ------- | ------ | ---------------------------------------------------- |
| `name`  | string | Rule name. Must match a `.md` file under `ai/rules/`.|
| `scope` | string | Where the rule is applied (`project` or `global`).   |

### Agents

Agents are Markdown files with YAML frontmatter that define specialized AI personas.

```yaml
ai:
  agents:
    - name: reviewer
      scope: project
```

Example agent file (`ai/agents/reviewer.md`):

```markdown
---
name: reviewer
description: Code review specialist
tools: [claude-code, cursor]
---

You are a code review specialist. Focus on:
- Code quality and readability
- Performance implications
- Security vulnerabilities
- Test coverage
```

### Memory

Memory files provide persistent context that AI tools can reference across sessions.

```yaml
ai:
  memory:
    - source: MEMORY.md
      merge: append
```

| Field    | Type   | Description                                                    |
| -------- | ------ | -------------------------------------------------------------- |
| `source` | string | Path to the memory file relative to the profile's `ai/memory/`.|
| `merge`  | string | Merge strategy when combining with existing memory.            |

### Commands

Commands are Markdown files that define executable actions for AI tools.

```yaml
ai:
  commands:
    - name: deploy
      scope: project
```

---

## File Placements

The `files` array declares static files that should be copied into consumer projects.

```yaml
files:
  - source: files/.editorconfig
    target: .editorconfig
    merge: replace
  - source: files/biome.json
    target: biome.json
    merge: deep
  - source: files/.gitignore
    target: .gitignore
    merge: append
```

| Field    | Type   | Required | Description                                                |
| -------- | ------ | -------- | ---------------------------------------------------------- |
| `source` | string | yes      | Path to the file relative to the profile directory.        |
| `target` | string | yes      | Destination path relative to the consumer project root.    |
| `merge`  | string | no       | Merge strategy. Defaults to `replace`.                     |

### Merge Strategies

| Strategy    | Description                                                        |
| ----------- | ------------------------------------------------------------------ |
| `replace`   | Overwrite the target file entirely.                                |
| `deep`      | Deep-merge JSON/YAML objects (profile values take precedence).     |
| `append`    | Append profile content to the end of the existing file.            |
| `prepend`   | Prepend profile content to the beginning of the existing file.     |
| `skip`      | Do nothing if the target file already exists.                      |
| `prompt`    | Ask the user what to do during sync.                               |
| `directory` | Copy an entire directory.                                          |
| `import`    | Import and process the file through Baton's template engine.       |

---

## IDE Settings

The `ide` block declares editor-specific configurations.

```yaml
ide:
  vscode:
    settings: ide/vscode/settings.json
    extensions: ide/vscode/extensions.json
```

Currently supported IDE targets:

| IDE      | Key        | Description            |
| -------- | ---------- | ---------------------- |
| VS Code  | `vscode`   | Settings & extensions  |

Each IDE entry can include:

| Field        | Type   | Description                                      |
| ------------ | ------ | ------------------------------------------------ |
| `settings`   | string | Path to the settings file relative to the profile.|
| `extensions` | string | Path to the extensions file relative to the profile.|

---

## Inheritance

Profiles can extend other profiles using the `extends` field. This allows you to define a base profile with shared configuration and have specialized profiles build on top of it.

```yaml
extends:
  - ../base
```

The `extends` field accepts an array of relative paths pointing to parent profiles. When a profile extends another:

1. The parent profile's configurations are loaded first.
2. The child profile's configurations are layered on top.
3. Conflicts are resolved in favor of the child profile.

This is useful for creating a hierarchy like:

```
profiles/
├── base/              # shared rules, common files
│   └── baton.profile.yaml
├── frontend/          # extends base, adds frontend-specific config
│   └── baton.profile.yaml
└── backend/           # extends base, adds backend-specific config
    └── baton.profile.yaml
```

---

## Weight

The `weight` field controls the priority ordering when multiple profiles are applied to the same project. Profiles with a higher weight take precedence during merge conflicts.

```yaml
weight: 10
```

| Value | Meaning                                                     |
| ----- | ----------------------------------------------------------- |
| `-1`  | Lowest priority. Applied first, easily overridden.          |
| `0`   | Default weight. Standard priority.                          |
| `10`  | Higher priority. Overrides profiles with lower weight.      |
| `100` | Very high priority. Use for critical, non-negotiable rules. |

When two profiles modify the same file or rule, the profile with the higher weight wins. If weights are equal, profiles are applied in the order they appear in `baton.yaml`.

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
  pre-sync:
    - echo "Starting sync..."
    - npm run clean
  post-sync:
    - echo "Sync complete!"
    - npm install
```

| Hook        | When it runs                         |
| ----------- | ------------------------------------ |
| `pre-sync`  | Before profile files are written.    |
| `post-sync` | After all profile files are written. |

Each hook is an array of shell commands that run sequentially. If any command fails, the sync process is halted and an error is reported.

---

## Next Steps

- [Using Profiles](./05-using-profiles.md) -- learn how to consume profiles in your projects.
- [Creating Sources](./03-creating-sources.md) -- learn how to package profiles into distributable sources.
