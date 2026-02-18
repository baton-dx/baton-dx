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

Resolve, merge, transform, and place all configurations from your profiles into the project.

```bash
baton sync
baton sync --dry-run
baton sync --verbose
baton sync --category ai
```

| Flag | Description |
|------|-------------|
| `--category <type>` | Filter by category: `ai`, `files`, or `ide` |

**Process:**
1. Fetches/resolves all profile sources
2. Loads and validates profile manifests
3. Merges profiles in order (respecting weight and inheritance)
4. Transforms configs for each AI tool's format
5. Places files in correct locations
6. Updates `baton.lock` with resolved versions

---

### `baton update`

Check for and apply updates to installed profiles.

```bash
baton update
baton update --dry-run
baton update --yes
```

Compares the locked versions in `baton.lock` against the latest available versions from sources. Shows a summary of available updates and prompts for confirmation.

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

### `baton manage`

Interactive project management wizard. Provides a menu-driven interface for common operations.

```bash
baton manage
```

**Options:**
- Overview — Show project status and configuration
- Add Profile — Add a new profile from a source
- Remove Profile — Remove an installed profile
- Remove Baton — Remove Baton from the project

---

### `baton config`

Show dashboard overview or configure settings.

```bash
baton config              # Show dashboard
baton config list         # List all settings
baton config get <key>    # Get a setting value
baton config set <key> <value>  # Set a setting value
```

**Settings:**
- `default-scope` — Default scope for new configs (`project` or `global`)
- `symlink-mode` — Use symlinks instead of copies (`true` or `false`)

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
baton source connect file:///path/to/local/source --name local
```

| Flag | Description |
|------|-------------|
| `--name <name>` | Human-readable name for the source |

**Supported URL formats:**
- `github:org/repo` — GitHub repository
- `gitlab:org/repo` — GitLab repository
- `file:///path` — Local directory
- `git:https://...` — Any Git URL

---

### `baton source disconnect <name>`

Remove a global source registration.

```bash
baton source disconnect my-team
```

Removes the source from `~/.baton/config.yaml`. Does not affect existing projects using this source.

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
