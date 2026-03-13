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
      merge: replace

extras:                          # optional: additional metadata
  scripts:
    - name: setup
      command: bun install

gitignore: true                  # optional: manage .gitignore entries
# or granular form:
# gitignore:
#   ai-tools: true               # gitignore AI tool config dirs
#   ides: false                  # do not gitignore IDE config dirs
#   files: true                  # gitignore placed custom files
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
| `gitignore` | boolean \| object | no | Manage `.gitignore` entries. `true` = manage all categories. Object form: `{ ai-tools, ides, files }` each boolean. |

---

## Profile Manifest — `baton.profile.yaml`

Declares identity and options. Content is auto-discovered from the profile's directory structure — no explicit declarations needed.

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

hooks:
  post-install: "npm install"   # runs after baton init installs this profile
  post-update: "npm install"    # runs after baton sync updates this profile
```

| Field         | Type     | Required | Description                                                      |
| ------------- | -------- | -------- | ---------------------------------------------------------------- |
| `name`        | string   | yes      | Profile name (kebab-case)                                        |
| `version`     | string   | no       | Semver version                                                   |
| `description` | string   | no       | Human-readable description                                       |
| `extends`     | string   | no       | Sibling profile to inherit from (e.g. `../base`)                 |
| `weight`      | number   | no       | Priority (-1 to Infinity, default 0). Higher = applied later     |
| `scope`       | string   | no       | Default scope for all content (`project` or `global`)            |
| `ai.tools`    | string[] | no       | AI tools this profile targets (default: all detected)            |
| `variables`   | object   | no       | Default variable values for template substitution                |
| `hooks`       | object   | no       | Lifecycle hooks (`post-install`, `post-update`)                  |

Content is auto-discovered from:

| Directory        | What Baton discovers                           |
| ---------------- | ---------------------------------------------- |
| `ai/memory/`     | `MEMORY.md` — memory file                      |
| `ai/rules/`      | `*.md` — rule files                            |
| `ai/agents/`     | `*.md` — agent files with frontmatter           |
| `ai/skills/`     | `*/SKILL.md` — skill directories               |
| `ai/commands/`   | `*.md` — command files                         |
| `ai/mcp/`        | `*.yaml` — MCP server definitions              |
| `files/`         | `**/*` — files placed in consumer project root |
| `ide/{platform}/`| `**/*` — IDE-specific files                    |

Files whose name starts with `_` are excluded (draft convention).

### Frontmatter Keys (stripped at sync time)

| Key     | Values                | Supported in                          |
| ------- | --------------------- | ------------------------------------- |
| `merge` | `concat` \| `replace` | `ai/memory/MEMORY.md`, `files/**`    |
| `scope` | `project` \| `global` | any content file                     |

### MCP Server File (`ai/mcp/*.yaml`)

| Field       | Type     | Required | Description                                                        |
| ----------- | -------- | -------- | ------------------------------------------------------------------ |
| `transport` | string   | yes      | `stdio`, `http`, or `sse`                                          |
| `command`   | string   | no       | Executable (required for `stdio`)                                  |
| `args`      | string[] | no       | Command arguments                                                  |
| `env`       | object   | no       | Env vars. Values must be `${VAR}` or `${VAR:-default}` syntax.    |
| `url`       | string   | no       | Server URL (required for `http`/`sse`)                             |
| `headers`   | object   | no       | HTTP headers (for `http`/`sse`)                                    |
| `scope`     | string   | no       | `project` or `global`. Defaults to `project`.                     |
| `tools`     | string[] | no       | Restrict to specific tool keys. Omit for all installed tools.     |

---

## Source Manifest — `baton.source.yaml`

Defines a source repository. Lives in the source repo root.

```yaml
name: my-team-configs
version: 1.0.0
description: Team DX standards
repository: github:my-org/dx-configs

# Profiles are auto-discovered from the profiles/ directory.

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
| `metadata` | object | no | Additional metadata |

Profiles are auto-discovered: any subdirectory under `profiles/` that contains a valid `baton.profile.yaml` is automatically included. No explicit `profiles:` list is needed.

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

---

## Environment Variables

Baton reads these environment variables for Git authentication. When accessing a private source repository, Baton checks them in cascade order — the first match wins.

| Variable | Purpose |
|----------|---------|
| `GITHUB_TOKEN` | GitHub personal access token. Widely supported by GitHub tooling. |
| `GH_TOKEN` | GitHub CLI token. Equivalent to `GITHUB_TOKEN`. |
| `BATON_GIT_TOKEN` | Generic Git host token. Use for GitLab, Bitbucket, or self-hosted repos. |

> **Tip:** Avoid setting tokens with `export` in an interactive shell — they're written to shell history. Add the export to `~/.zshenv` (zsh) or `~/.bash_profile` (bash) instead, or use `gh auth login` which stores tokens securely.

### Auth cascade order

When Baton needs credentials for a Git host, it tries the following sources in order:

1. **Environment variables** — `GITHUB_TOKEN`, `GH_TOKEN`, or `BATON_GIT_TOKEN`
2. **SSH keys** — auto-detected from `~/.ssh/id_*` with a connectivity check
3. **GitHub CLI** — `gh auth token` (GitHub hosts only)
4. **Git credential helper** — system credential store (macOS Keychain, Windows Credential Manager, etc.)

If no method succeeds, Baton prints a clear error with setup instructions. It never prompts interactively and never hangs.

Results are cached per hostname for the duration of the command, so the cascade only runs once per host.
