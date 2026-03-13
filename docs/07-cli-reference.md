# CLI Reference

Complete reference for all Baton CLI commands.

## Global Options

These flags are available on every command:

| Flag | Alias | Description |
|------|-------|-------------|
| `--help` | `-h` | Show help message |
| `--version` | `-v` | Show version number |
| `--yes` | `-y` | Suppress all interactive prompts (non-interactive mode) |
| `--dry-run` | | Show what would be done without writing files |
| `--verbose` | | Enable debug logging |

---

## Project Commands

### `baton init`

Initialize Baton in your project. Runs an interactive wizard that detects AI tools and IDEs, lets you select a source and profiles, and creates `baton.yaml`.

```bash
baton init
baton init --profile github:org/repo/profile-name
baton init --yes
baton init --force
```

| Flag | Description |
|------|-------------|
| `--profile <source>` | Use a specific profile source (skip source selection) |
| `--force` | Overwrite existing `baton.yaml` |

**Creates:** `baton.yaml`, `.baton/` directory, updates `.gitignore`

---

### `baton sync`

Fetch the latest versions of all sources, merge, transform, and place configurations into the project. Always fetches fresh — does not use cached or locked versions.

```bash
baton sync
baton sync --dry-run
baton sync --verbose
baton sync --category ai
baton sync --check
baton sync --yes
```

| Flag | Description |
|------|-------------|
| `--category <type>` | Filter by category: `ai`, `files`, or `ide` |
| `--check` | Read-only stale check — exits 0 if in sync, 1 if stale (does not write files) |
| `--dry-run` | Show what would be done without writing files |
| `--verbose` | Show detailed per-file report (created / updated / skipped / removed) |
| `--yes` | Run non-interactively (skip all prompts) |

**Process:**
1. Fetches **latest versions** of all profile sources (always fresh)
2. Loads and validates profile manifests
3. Merges profiles in order (respecting weight and inheritance)
4. Transforms configs for each AI tool's format
5. Places files in correct locations
6. Runs profile `post-install` / `post-update` hooks (if defined)
7. Updates `baton.lock` with resolved commit SHAs

**`--check` mode** is read-only and safe to run in CI pre-merge checks:
```bash
baton sync --check && echo "In sync" || echo "Run baton sync to update"
```

---

### `baton apply`

Apply locked configurations from `baton.lock` for deterministic, reproducible builds. Uses exact commit SHAs from the lockfile instead of fetching latest.

```bash
baton apply
baton apply --dry-run
baton apply --verbose
baton apply --category ai
baton apply --fresh
baton apply --yes
```

| Flag | Description |
|------|-------------|
| `--category <type>` | Filter by category: `ai`, `files`, or `ide` |
| `--fresh` | Force cache bypass (re-clone even if cached) |
| `--dry-run` | Show what would be done without writing files |
| `--verbose` | Show detailed per-file report (created / updated / skipped / removed) |
| `--yes` | Run non-interactively (skip all prompts) |

**Use cases:** CI/CD pipelines, onboarding new team members, reproducible builds.

---

### `baton diff`

Compare local files with remote source versions. Useful for detecting local modifications to synced files.

```bash
baton diff
baton diff --name-only
```

| Flag | Description |
|------|-------------|
| `--name-only` | Show only filenames, not content diffs |

**Exit codes:**
- `0` — No differences found
- `1` — Differences detected

---

### `baton preview`

Preview the processed output for a specific AI tool, with full directive processing applied. Use this to inspect what Baton will write before running `baton sync`.

```bash
baton preview --tool <key>
baton preview --tool claude-code --type rules
baton preview --tool cursor --diff windsurf
```

| Flag | Description |
|------|-------------|
| `--tool <key>` | AI tool key to preview for (e.g. `claude-code`, `cursor`) — **required** |
| `--type <type>` | Filter to a content type: `memory`, `rules`, `agents`, `skills`, `commands` |
| `--diff <key>` | Compare output against a second tool side by side |

---

### `baton manage`

Interactive project management wizard. Provides a menu-driven interface for common operations. The Overview section shows resolved tool preferences (project-level overrides take effect when configured).

```bash
baton manage
```

**Options:**
- Overview — Show project status, resolved tool preferences, and configuration
- Add Profile — Add a new profile from a source
- Remove Profile — Remove an installed profile
- Remove Baton — Remove Baton from the project

---

### `baton config`

Show dashboard overview or configure settings.

```bash
baton config                    # Show dashboard
baton config set <key> <value>  # Set a setting value
```

**Settings:**
- `default-scope` — Default scope for new configs (`project` or `global`)
- `symlink-mode` — Use symlinks instead of copies (`true` or `false`)

---

### `baton self-update`

Update Baton CLI to the latest stable version.

```bash
baton self-update
baton self-update --changelog
baton self-update --dry-run
baton self-update --yes
```

| Flag | Description |
|------|-------------|
| `--changelog` | Show release notes for the new version |
| `--dry-run` | Check for updates without installing |
| `--yes`, `-y` | Skip confirmation prompt |

---

## Auth Commands

### `baton auth status`

Diagnose authentication for private source repositories. Runs the full auth cascade and shows which methods are available.

```bash
baton auth status
baton auth status --hostname gitlab.example.com
```

| Flag | Description |
|------|-------------|
| `--hostname <host>` | Test auth for a specific hostname (default: github.com) |

---

## Source Commands

### `baton source create <name>`

Scaffold a new source repository with profile templates.

```bash
baton source create my-configs
baton source create my-configs --yes
```

Creates a directory with `baton.source.yaml`, a default profile, README, and optionally initializes a Git repository.

**Name validation:** Must be kebab-case (e.g., `my-team-configs`).

---

### `baton source list`

List all registered global sources.

```bash
baton source list
```

Shows each source's name, URL, and whether it's set as default.

---

### `baton source connect <url>`

Register a source repository globally for reuse across projects.

```bash
baton source connect github:org/repo --name my-team
baton source connect file:/path/to/local/source --name local
```

| Flag | Description |
|------|-------------|
| `--name <name>` | Human-readable name for the source |

**Supported URL formats:**
- `github:org/repo` — GitHub repository
- `gitlab:org/repo` — GitLab repository
- `file:path` — Local directory (relative or absolute)
- `https://git.example.com/repo.git` — Any HTTPS Git URL
- `git@host:org/repo.git` — SSH Git URL

---

### `baton source disconnect <name>`

Remove a global source registration.

```bash
baton source disconnect my-team
```

Removes the source from `~/.baton/config.yaml`. Does not affect existing projects using this source.

---

### `baton source validate [path]`

Validate a source repository's structure, manifests, profiles, and content layout.

```bash
baton source validate            # validate cwd
baton source validate ./my-source
```

| Argument | Description |
|----------|-------------|
| `[path]` | Path to the source directory (default: current directory) |

---

## Profile Commands

### `baton profile create <name>`

Create a new profile in the current source repository.

```bash
cd my-source-repo
baton profile create frontend
```

Must be run inside a directory containing `baton.source.yaml`. Creates a `profiles/<name>/` directory with a `baton.profile.yaml` manifest.

**Name validation:** Must be kebab-case.

---

### `baton profile list`

List profiles in the current source repository or project.

```bash
baton profile list
```

Shows each profile's name, version, and description.

---

### `baton profile remove <name>`

Remove a profile from the current source repository.

```bash
baton profile remove backend
```

Prompts for confirmation before deleting the profile directory.

---

## AI Tools Commands

### `baton ai-tools scan`

Detect installed AI tools on the system.

```bash
baton ai-tools scan
baton ai-tools scan --yes
```

Scans for 14 supported AI tools by checking for CLI binaries and config directories. Prompts to save detected tools to `~/.baton/config.yaml`.

---

### `baton ai-tools list`

List configured AI tools.

```bash
baton ai-tools list
baton ai-tools list --all
baton ai-tools list --json
```

| Flag | Description |
|------|-------------|
| `--all` | Show all 14 supported tools (including uninstalled) |
| `--json` | Output as JSON (no UI formatting) |

---

### `baton ai-tools configure`

Manually select which AI tools Baton manages (interactive multi-select).

```bash
baton ai-tools configure
baton ai-tools configure --yes
baton ai-tools configure --project
```

| Flag | Description |
|------|-------------|
| `--yes`, `-y` | Keep current selection unchanged |
| `--project` | Configure for this project only (writes to `baton.yaml`) |

---

## IDE Commands

### `baton ides scan`

Detect installed IDE platforms.

```bash
baton ides scan
baton ides scan --yes
```

Scans for supported IDE platforms (VS Code, JetBrains, Cursor, Windsurf, Antigravity, Zed).

---

### `baton ides list`

List configured IDE platforms.

```bash
baton ides list
baton ides list --all
baton ides list --json
```

| Flag | Description |
|------|-------------|
| `--all` | Show all supported platforms (including undetected) |
| `--json` | Output as JSON (no UI formatting) |

---

### `baton ides configure`

Manually select which IDE platforms Baton manages (interactive multi-select).

```bash
baton ides configure
baton ides configure --yes
baton ides configure --project
```

| Flag | Description |
|------|-------------|
| `--yes`, `-y` | Keep current selection unchanged |
| `--project` | Configure for this project only (writes to `baton.yaml`) |
