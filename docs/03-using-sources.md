# Using Sources

A **source** is a Git repository or npm package that bundles one or more **profiles** for distribution. Think of a source as a package that your team publishes once and every project can install from. Before you can pick profiles in `baton init`, you need to know the source URI.

Sources contain one or more profiles — learn how to use profiles in your project in the [next guide](./04-using-profiles.md).

---

## Source URI Formats

| Format | Example | Description |
|--------|---------|-------------|
| `github:org/repo` | `github:my-org/dx-configs` | GitHub repository |
| `gitlab:org/repo` | `gitlab:my-org/dx-configs` | GitLab repository |
| `https://...` | `https://git.corp.io/dx.git` | Any HTTPS Git URL |
| `git@...` | `git@github.com:org/repo.git` | SSH Git URL |
| `npm:@org/pkg` | `npm:@my-org/dx-configs` | npm package |
| `file:path` | `file:../local-configs` | Local directory |

### Version Pinning

Append `@ref` to pin to a specific tag or branch:

```
github:my-org/dx-configs@v1.2.0
github:my-org/dx-configs@main
```

Combined with a profile name:

```
github:my-org/dx-configs@v1.2.0/frontend
```

---

## Connecting a Source (Global Registration)

Registering a source globally makes it available in `baton init`'s interactive picker across all your projects:

```bash
baton source connect github:my-org/dx-configs --name my-team
baton source connect file:../local-configs --name local-dev
```

What this does:

- Registers the source in `~/.baton/config.yaml`
- The source appears in the `baton init` interactive picker
- Prompts to preview available profiles immediately after connecting

Manage registered sources:

```bash
baton source list              # show all registered sources
baton source disconnect my-team   # remove a registration
```

---

## Using a Source in a Project

There are two ways to use a source in a project.

### Via `baton init` (registered sources appear in picker)

```bash
baton init
```

Registered sources appear automatically in the interactive source picker.

### Directly in `baton.yaml` (no registration needed)

```yaml
profiles:
  - source: github:my-org/dx-configs/frontend
```

Any valid source URI works directly in `baton.yaml` — registration is optional.

**When to register:** Shared team setups, multiple projects reusing the same source.
**When to go inline:** CI pipelines, public sources, one-off usage.

---

## Local Sources (`file:`)

The `file:` prefix accepts both relative and absolute paths:

```bash
# Relative path (resolved from the project directory)
file:../my-source

# Absolute path
file:/absolute/path/to/source
```

Changes to a local source are picked up on the next `baton sync` — no publish step required.

---

## Authentication

Baton auto-detects credentials for private sources:

- **SSH:** Uses your SSH agent or key files automatically.
- **GitHub CLI:** If `gh auth login` has been run, Baton uses those credentials.
- **Environment variables:** `GITHUB_TOKEN`, `GITLAB_TOKEN` are recognized.

The quickest setup for private GitHub sources is `gh auth login`. See [Configuration Reference → Environment Variables](./08-configuration-reference.md#environment-variables) for details.

---

## Next Steps

- [Using Profiles](./04-using-profiles.md) — configure profiles in your project
- [Creating Sources](./05-creating-sources.md) — build and publish your own source repository
