# Using Profiles

Once a source repository has been published with one or more profiles, you can consume those profiles in any project. This guide covers the full workflow: initializing a project, configuring profiles, syncing, updating, and managing ongoing changes.

---

## Initializing a Project

The `baton init` command sets up a project to use Baton. It creates a `baton.yaml` manifest and walks you through selecting sources and profiles.

```bash
baton init
```

The interactive flow prompts you to:

1. Choose which AI tools your project targets (e.g. `claude-code`, `cursor`).
2. Add one or more source/profile references.
3. Set any project-level variables.

You can also pass options directly:

```bash
baton init \
  --target claude-code \
  --target cursor \
  --profile github:my-org/dx-configs/frontend
```

After initialization, your project root will contain a `baton.yaml` file.

---

## Project Manifest (`baton.yaml`)

The `baton.yaml` file is the project-level configuration. It declares which profiles to apply, which AI tools to target, and any project-specific overrides.

### Example

```yaml
profiles:
  - source: github:my-org/dx-configs/frontend
  - source: github:my-org/dx-configs/backend
ai:
  targets: [claude-code, cursor]
variables:
  project_name: My App
overrides:
  files:
    .gitignore:
      merge: replace
```

### Field Reference

| Field       | Type     | Required | Description                                                    |
| ----------- | -------- | -------- | -------------------------------------------------------------- |
| `profiles`  | array    | yes      | List of profile source references to apply.                    |
| `ai`        | object   | no       | AI tool targeting configuration.                               |
| `variables` | object   | no       | Project-level variables that override profile defaults.        |
| `overrides` | object   | no       | Per-file or per-rule overrides for fine-grained control.       |

### Profile entries

Each entry in the `profiles` array specifies a source reference:

```yaml
profiles:
  - source: github:my-org/dx-configs/frontend
  - source: npm:@my-org/dx-configs/backend
  - source: file:../local-configs/experimental
```

The source string format is `<transport>:<repository>/<profile-name>`. You can optionally pin a version:

```yaml
profiles:
  - source: github:my-org/dx-configs@v1.2.0/frontend
```

### AI targets

The `ai.targets` array limits which AI tools Baton writes configurations for. Only tools listed here will receive rules, skills, agents, memory, and commands from the applied profiles.

```yaml
ai:
  targets: [claude-code, cursor, windsurf]
```

If `ai.targets` is omitted, Baton uses the union of all `ai.tools` declared by the applied profiles.

---

## Adding Profiles

### During init

The `baton init` wizard lets you add profiles interactively. You can also pass `--profile` flags:

```bash
baton init --profile github:my-org/dx-configs/frontend
```

### After init

Add profiles to an existing project by editing `baton.yaml` directly, or use the interactive manager:

```bash
baton manage
```

Select **Add Profile** to pick from connected sources. Baton updates `baton.yaml` and runs a sync automatically.

---

## Multi-Profile Layering

When a project uses multiple profiles, Baton merges their configurations together in a deterministic order.

### Merge order

1. Profiles are sorted by **weight** (lowest first).
2. Profiles with equal weight are applied in the order they appear in `baton.yaml`.
3. Each profile's configurations are layered on top of the previous result.
4. Project-level `overrides` are applied last.

### Example

Given this configuration:

```yaml
profiles:
  - source: github:my-org/dx-configs/base       # weight: 0
  - source: github:my-org/dx-configs/frontend    # weight: 10
  - source: github:my-org/dx-configs/strict      # weight: 100
```

The merge order is: `base` (0) -> `frontend` (10) -> `strict` (100). If `base` and `frontend` both provide a `coding-style` rule, the `frontend` version wins because it has a higher weight. The `strict` profile overrides both.

### Conflict resolution

| Scenario                       | Resolution                                    |
| ------------------------------ | --------------------------------------------- |
| Same file, different weights   | Higher weight wins.                           |
| Same file, equal weights       | Later profile in `baton.yaml` wins.           |
| Same rule, different scopes    | Both are applied (different scope targets).   |
| File with `merge: concat` (default) | Content from all profiles is concatenated with `\n\n` separator. |
| File with `merge: replace`     | Last profile (highest weight) completely overwrites. |

---

## Syncing

The `baton sync` command **always fetches the latest versions** of all sources, resolves profiles, merges configurations, and writes the result to your working directory. After syncing, the lockfile (`baton.lock`) is updated with the resolved commit SHAs.

```bash
baton sync
```

What happens during sync:

1. Baton reads `baton.yaml`.
2. Sources are fetched at their **latest version** (always fresh, no cache).
3. Profiles are resolved and sorted by weight.
4. AI configurations are generated for each targeted tool.
5. Files are placed according to their merge strategies.
6. IDE settings are written.
7. The lockfile (`baton.lock`) is updated with exact commit SHAs.

### Dry run

Preview what sync will do without writing any files:

```bash
baton sync --dry-run
```

---

## Applying (Deterministic)

The `baton apply` command uses the **locked SHAs from `baton.lock`** to reproduce the exact same configuration every time. This is the command you should use in CI/CD pipelines and for onboarding new team members.

```bash
baton apply
```

What happens during apply:

1. Baton reads `baton.yaml` and `baton.lock`.
2. Sources are fetched at the **exact SHA recorded in the lockfile**.
3. Everything else works the same as sync (resolve, merge, transform, place).

### When to use which

| Scenario | Command |
| -------- | ------- |
| Get the latest versions from sources | `baton sync` |
| Reproduce the exact locked state (CI, onboarding) | `baton apply` |
| First-time setup after `baton init` | `baton sync` |

### Cache bypass

If you need to force re-cloning even when a cached copy exists:

```bash
baton apply --fresh
```

---

## Lockfile (`baton.lock`)

After every sync or apply, Baton writes a `baton.lock` file that records the exact versions and commit hashes of every source that was resolved.

### Purpose

The lockfile ensures **reproducibility**. When another team member clones the project and runs `baton apply`, they get the exact same configuration, even if the source repository has received new commits since the last sync.

### Commit to version control

Always commit `baton.lock` to your repository:

```bash
git add baton.lock
git commit -m "chore: update baton lockfile"
```

### Lockfile behavior

| Command       | Lockfile behavior                                                  |
| ------------- | ------------------------------------------------------------------ |
| `baton sync`  | Fetches latest versions, then **writes** the lockfile.             |
| `baton apply` | **Reads** the lockfile. Uses locked SHAs for deterministic builds. |
| `baton update`| *(deprecated)* Delegates to `baton sync`.                          |

---

## Updating (Deprecated)

> **Note:** `baton update` is deprecated. Use `baton sync` instead.

The `baton update` command now shows a deprecation warning and delegates to `baton sync`.

```bash
# Deprecated — use baton sync instead
baton update

# Equivalent:
baton sync
```

After syncing, review the changes:

```bash
baton diff
```

If everything looks good, commit the updated lockfile:

```bash
git add baton.lock
git commit -m "chore: update baton dependencies"
```

---

## Diffing

The `baton diff` command shows what would change if you ran a sync or update. It compares the current project state against the resolved profile configurations.

```bash
baton diff
```

This is useful for:

- Reviewing changes before committing after an update.
- Detecting local modifications that diverge from the profile.
- Understanding what a new profile will change before adding it.

---

## Managing

The `baton manage` command provides an interactive interface for managing the profiles applied to your project.

```bash
baton manage
```

From the management interface you can:

- View all applied profiles and their sources.
- Add or remove profiles.
- Change AI tool targets.
- Modify project-level variables and overrides.
- Re-run sync after making changes.

---

## Overrides

Project-level overrides in `baton.yaml` let you customize how specific files or rules are handled, without forking the source profile.

```yaml
overrides:
  files:
    .gitignore:
      merge: replace
  rules:
    coding-style:
      scope: global
```

Overrides are applied after all profiles have been merged, giving the project the final say on any configuration.

---

## Official Baton Profiles

Baton provides official profiles via [`baton-dx-source`](https://github.com/baton-dx/baton-dx-source) to help you get started:

| Profile | Audience | What you get |
| ------- | -------- | ------------ |
| `consumer` | Project developers | CLI reference, sync workflows, troubleshooting skills, project conventions |
| `creator` | Source/profile authors | Profile schemas, merge strategies, tool transformations, publishing guides |
| `maintainer` | Baton contributors | Monorepo architecture, adapter development, code quality, release workflows |

To add Baton's consumer profile to your project for AI-assisted guidance on using Baton:

```bash
baton init --profile github:baton-dx/baton-dx-source/consumer
baton sync
```

This gives your AI tools full context about `baton init`, `baton sync`, `baton apply`, `baton diff`, and other CLI commands — so they can help you manage your Baton configuration effectively.

---

## Next Steps

- [Creating Sources](./03-creating-sources.md) -- learn how to build and publish your own source repositories.
- [Creating Profiles](./04-creating-profiles.md) -- learn the full profile manifest schema and all configuration options.
