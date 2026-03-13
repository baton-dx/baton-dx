# Creating Sources

A **source repository** is the distribution unit for Baton configurations. It groups one or more **profiles** into a single, versioned package that teams can consume from GitHub, GitLab, npm, or a local filesystem. Think of a source as an npm package, and profiles as the modules it exports.

---

## What is a Source Repository

A source repository is any directory (typically a Git repo) that contains a `baton.source.yaml` manifest at its root. The manifest declares metadata about the source -- its name, version, and description. Profiles are auto-discovered from the `profiles/` directory.

Sources can be hosted on any supported transport:

| Prefix     | Example                                  | Description                        |
| ---------- | ---------------------------------------- | ---------------------------------- |
| `github:`  | `github:my-org/dx-configs`               | GitHub repository                  |
| `gitlab:`  | `gitlab:my-org/dx-configs`               | GitLab repository                  |
| `git:`     | `git:https://git.internal.co/dx-configs` | Any Git remote                     |
| `npm:`     | `npm:@my-org/dx-configs`                 | npm registry package               |
| `file:`    | `file:../local-configs`                  | Local filesystem path              |

When a consumer runs `baton sync`, Baton resolves the source URI, fetches the repository, reads `baton.source.yaml`, and extracts the requested profiles.

---

## Creating a Source

The fastest way to scaffold a new source is with the `baton source create` command:

```bash
baton source create my-team-configs
```

This generates a ready-to-use directory with the manifest and an example profile. You can also pass a description:

```bash
baton source create my-team-configs \
  --description "Team DX standards"
```

If you prefer to set things up manually, create a directory, add a `baton.source.yaml` file, and start adding profiles.

---

## Source Manifest (`baton.source.yaml`)

The manifest is the single source of truth for the repository. It lives at the root of the source directory.

### Example

```yaml
name: my-team-configs
version: 1.0.0
description: Team DX standards
repository: github:my-org/dx-configs

# Profiles are auto-discovered from the profiles/ directory.
```

### Field Reference

| Field         | Type     | Required | Description                                                        |
| ------------- | -------- | -------- | ------------------------------------------------------------------ |
| `name`        | string   | yes      | Unique name for the source. Used in source URIs.                   |
| `version`     | string   | yes      | Semver version string (e.g. `1.0.0`).                             |
| `description` | string   | no       | Human-readable description of the source.                          |
| `repository`  | string   | no       | Canonical URI where the source is hosted.                          |

Profiles are auto-discovered: any subdirectory under `profiles/` that contains a valid `baton.profile.yaml` is automatically included. No explicit `profiles:` list is needed in the source manifest.

### Validation

Baton validates the manifest on every operation. Common issues:

- **Invalid version** -- the `version` field must be a valid semver string.
- **Missing profile manifest** -- every profile directory must contain a valid `baton.profile.yaml`.

Run `baton source validate` to check your manifest without syncing.

---

## Directory Layout

A well-organized source follows this conventional structure:

```
my-team-configs/
├── baton.source.yaml
├── profiles/
│   ├── frontend/
│   │   ├── baton.profile.yaml
│   │   ├── ai/
│   │   │   ├── memory/
│   │   │   │   └── MEMORY.md
│   │   │   ├── rules/
│   │   │   │   ├── coding-style.md
│   │   │   │   └── testing.md
│   │   │   ├── agents/
│   │   │   │   └── reviewer.md
│   │   │   ├── skills/
│   │   │   │   └── code-review/
│   │   │   │       └── SKILL.md
│   │   │   ├── commands/
│   │   │   │   └── deploy.md
│   │   │   └── mcp/
│   │   │       └── filesystem.yaml
│   │   ├── files/
│   │   │   ├── .editorconfig
│   │   │   └── biome.json
│   │   └── ide/
│   │       └── vscode/
│   │           ├── settings.json
│   │           └── extensions.json
│   └── backend/
│       ├── baton.profile.yaml
│       ├── ai/
│       │   ├── memory/
│       │   ├── rules/
│       │   ├── agents/
│       │   ├── skills/
│       │   ├── commands/
│       │   └── mcp/
│       ├── files/
│       └── ide/
└── README.md
```

### Key directories

| Directory         | Purpose                                                              |
| ----------------- | -------------------------------------------------------------------- |
| `profiles/`       | Contains all profile directories.                                    |
| `ai/memory/`      | `MEMORY.md` — one memory file per profile.                          |
| `ai/rules/`       | `*.md` — rule files applied to all targeted AI tools.               |
| `ai/agents/`      | `*.md` — agent definitions with YAML frontmatter.                   |
| `ai/skills/`      | `*/SKILL.md` — skill directories.                                    |
| `ai/commands/`    | `*.md` — command definitions.                                        |
| `ai/mcp/`         | `*.yaml` — MCP server configurations.                               |
| `files/`          | Arbitrary files placed in consumer project root.                     |
| `ide/`            | IDE-specific settings (e.g. `ide/vscode/`).                         |

---

## Adding Profiles to a Source

Each profile lives in its own directory under `profiles/` and must contain a `baton.profile.yaml` manifest. See [Creating Profiles](./04-creating-profiles.md) for the full profile reference.

To add a new profile, run the following from inside the source directory:

```bash
baton profile create my-new-profile
```

This scaffolds the full directory structure and a starter `baton.profile.yaml`. Then validate:

```bash
baton source validate
```

---

## Publishing

### GitHub

The most common approach is to push the source to a GitHub repository:

```bash
git init
git add .
git commit -m "feat: initial source release"
git remote add origin git@github.com:my-org/dx-configs.git
git push -u origin main
```

Consumers reference it as:

```yaml
source: github:my-org/dx-configs/frontend
```

### GitLab

Same workflow, different prefix:

```yaml
source: gitlab:my-org/dx-configs/frontend
```

### npm

Package the source and publish to npm:

```bash
npm init --scope=@my-org
npm publish
```

Consumers reference it as:

```yaml
source: npm:@my-org/dx-configs/frontend
```

### Local / File

During development, use a local path:

```yaml
source: file:../dx-configs/frontend
```

This is especially useful for testing changes before publishing.

---

## Versioning

Baton follows **semver** conventions for source versioning.

### Version field

Set the `version` field in `baton.source.yaml`:

```yaml
version: 1.2.0
```

### Git tags

Tag releases with a `v` prefix to allow consumers to pin to specific versions:

```bash
git tag v1.2.0
git push origin v1.2.0
```

Consumers can then reference a specific version:

```yaml
source: github:my-org/dx-configs@v1.2.0/frontend
```

### When to bump versions

| Change type                        | Version bump |
| ---------------------------------- | ------------ |
| New profile added                  | minor        |
| New rule/skill in existing profile | minor        |
| Bug fix in a rule or config        | patch        |
| Breaking rename or removal         | major        |

### Best practices

- Always tag releases in Git so consumers can pin versions.
- Use a changelog to document what changed between versions.
- Test profiles locally (`file:` source) before publishing.
- Run `baton source validate` in CI to catch manifest issues early.

---

## Real-World Example: `baton-dx-source`

Baton's own official source repository [`baton-dx-source`](https://github.com/baton-dx/baton-dx-source) is a complete, production-grade example of everything described in this guide. It demonstrates:

- **Multi-audience profiles** — three specialized profiles (`maintainer`, `creator`, `consumer`) plus a shared `base` profile
- **Profile inheritance** — all three profiles extend `base` via `extends: ../base` to share common Baton knowledge without duplication
- **Weight-based layering** — `base` at weight 0, child profiles at weight 10
- **Full AI configuration** — skills, rules, agents, memory, and commands targeting all 14 AI tools
- **Conventional directory layout** — `profiles/<name>/ai/{skills,rules,agents,memory,commands}/`

```yaml
# baton.source.yaml (simplified)
name: baton-dx-source
version: 0.1.0

# Profiles are auto-discovered from the profiles/ directory.
# profiles/base/, profiles/maintainer/, profiles/creator/, profiles/consumer/
```

The `creator` profile is specifically designed for developers building their own sources and profiles. To get AI-assisted guidance while creating your own source:

```bash
baton init --profile github:baton-dx/baton-dx-source/creator
baton sync
```

This gives your AI tools context about profile schemas, merge strategies, tool transformations, and publishing workflows.

---

## Next Steps

- [Creating Profiles](./04-creating-profiles.md) -- learn how to define profile manifests and configure AI tools.
- [Using Profiles](./05-using-profiles.md) -- learn how to consume profiles in your projects.
