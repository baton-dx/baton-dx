# Configuration Reference

Complete schema reference for all Baton configuration files.

## Project Manifest — `baton.yaml`

Created by `baton init`. Lives in the project root.

```yaml
profiles:
  - source: github:org/repo/profile-name
    version: 1.0.0              # optional: pin version

ai:
  targets:                       # optional: limit to specific tools
    - claude-code
    - cursor

variables:                       # optional: template variables
  project_name: My App
  team_email: dev@acme.com

overrides:                       # optional: override merge strategies
  files:
    .gitignore:
      merge: skip

extras:                          # optional: additional metadata
  scripts:
    - name: setup
      command: bun install
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `profiles` | array | yes | List of profile sources to install |
| `profiles[].source` | string | yes | Source URL (github:, npm:, file:, etc.) |
| `profiles[].version` | string | no | Pin to specific version |
| `ai.targets` | string[] | no | Limit which AI tools to configure (default: all detected) |
| `variables` | object | no | Key-value pairs for template substitution |
| `overrides.files` | object | no | Per-file merge strategy overrides |
| `extras` | object | no | Additional project metadata |

---

## Profile Manifest — `baton.profile.yaml`

Defines a profile's contents. Lives in a profile directory within a source repo.

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
  rules:
    - name: coding-style
      scope: project
  agents:
    - name: reviewer
      scope: project
  memory:
    - source: MEMORY.md
      merge: append
  commands:
    - name: review
      scope: project
  mcp:
    - name: filesystem
      transport: stdio
      command: npx
      args: ["-y", "@modelcontextprotocol/server-filesystem"]
      env:
        ROOT_DIR: "${HOME}"
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

hooks:
  pre-sync: scripts/pre-sync.sh
  post-sync: scripts/post-sync.sh
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Profile name (kebab-case) |
| `version` | string | yes | Semver version (major.minor.patch) |
| `description` | string | no | Human-readable description |
| `extends` | string[] | no | Parent profiles to inherit from |
| `weight` | number | no | Priority (-1 to Infinity, default 0). Higher = applied later |
| `ai.tools` | string[] | no | AI tools this profile supports |
| `ai.skills` | array | no | Skill directories to place |
| `ai.rules` | array | no | Rule files to place |
| `ai.agents` | array | no | Agent files to place |
| `ai.memory` | array | no | Memory files to place |
| `ai.commands` | array | no | Command files to place |
| `ai.mcp` | array | no | MCP server definitions (placed into each tool's native config) |
| `files` | array | no | General files to place |
| `ide` | object | no | IDE-specific settings |
| `variables` | object | no | Default variable values |
| `hooks` | object | no | Lifecycle hooks |

### Skill Item

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Skill directory name |
| `scope` | `"project"` \| `"global"` | Where to place the skill |

### Rule Item

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Rule file name (without extension) |
| `scope` | `"project"` \| `"global"` | Where to place the rule |

### Memory Item

| Field | Type | Description |
|-------|------|-------------|
| `source` | string | Source file path (relative to profile) |
| `merge` | string | Merge strategy (typically `append` or `replace`) |

### File Item

| Field | Type | Description |
|-------|------|-------------|
| `source` | string | Source file path (relative to profile) |
| `target` | string | Target path in project |
| `merge` | string | Merge strategy |

### MCP Server Item

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Server name (kebab-case). Used as config key. |
| `transport` | `"stdio"` \| `"http"` \| `"sse"` | Connection type |
| `command` | string | Executable (required for `stdio`) |
| `args` | string[] | Command arguments |
| `env` | object | Env vars. Values must be `${VAR}` or `${VAR:-default}` syntax. |
| `url` | string | Server URL (required for `http`/`sse`) |
| `headers` | object | HTTP headers (for `http`/`sse`) |
| `scope` | `"project"` \| `"global"` | Placement scope. Defaults to `project`. |
| `tools` | string[] | Restrict to specific tool keys. Omit for all installed tools. |

---

## Source Manifest — `baton.source.yaml`

Defines a source repository. Lives in the source repo root.

```yaml
name: my-team-configs
version: 1.0.0
description: Team DX standards
repository: github:my-org/dx-configs

profiles:
  - name: frontend
    path: profiles/frontend
    description: Frontend development
  - name: backend
    path: profiles/backend
    description: Backend API development

metadata:
  author: ACME Corp
  license: MIT
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Source name (kebab-case) |
| `version` | string | yes | Semver version |
| `description` | string | no | Human-readable description |
| `repository` | string | no | Repository URL |
| `profiles` | array | no | List of profiles in this source |
| `profiles[].name` | string | yes | Profile name |
| `profiles[].path` | string | yes | Path to profile directory |
| `profiles[].description` | string | no | Profile description |
| `metadata` | object | no | Additional metadata |

---

## Lockfile — `baton.lock`

Auto-generated by `baton sync`. Pins exact versions for reproducibility. **Always commit to version control.**

```yaml
locked_at: "2026-02-18T12:00:00.000Z"
packages:
  github:org/repo/frontend:
    source: github:org/repo
    resolved: https://github.com/org/repo
    version: 1.0.0
    sha: abc123def456
    integrity: sha256-...
```

| Field | Type | Description |
|-------|------|-------------|
| `locked_at` | string | ISO 8601 timestamp of last lock |
| `packages` | object | Map of source URL → locked metadata |
| `packages[].source` | string | Original source URL |
| `packages[].resolved` | string | Resolved URL |
| `packages[].version` | string | Locked version |
| `packages[].sha` | string | Git commit SHA |
| `packages[].integrity` | string | SHA-256 integrity hash |

---

## Global Config — `~/.baton/config.yaml`

User-wide configuration. Managed by `baton config`, `baton source connect/disconnect`, and `baton ai-tools/ides scan`.

```yaml
version: "1.0"
sources:
  - name: my-team
    url: github:org/dx-configs
    default: true
    description: Team DX Standards

ai_tools:
  - claude-code
  - cursor
  - windsurf

ide_platforms:
  - vscode
  - cursor

settings:
  default_scope: global
  symlink_mode: false
```

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Config format version |
| `sources` | array | Registered global sources |
| `sources[].name` | string | Source display name |
| `sources[].url` | string | Source URL |
| `sources[].default` | boolean | Whether this is the default source |
| `sources[].description` | string | Source description |
| `ai_tools` | string[] | Detected/saved AI tool keys |
| `ide_platforms` | string[] | Detected/saved IDE platform keys |
| `settings.default_scope` | string | Default scope (`project` or `global`) |
| `settings.symlink_mode` | boolean | Use symlinks instead of file copies |
