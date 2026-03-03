# Quick Start

Get Baton running in your project in under 5 minutes.

## Step 1: Install Baton

```bash
bun install -g @baton-dx/cli
# or: brew install baton-dx
```

## Step 2: Connect a Source

Register a source repository that contains your team's profiles:

```bash
baton source connect github:your-org/dx-configs --name my-team
```

> **Don't have a source yet?** Create one with `baton source create my-configs`.
> See [Creating Sources](./03-creating-sources.md) for details.
>
> **Want AI-assisted Baton usage?** Connect the official Baton source and sync the `consumer` profile:
>
> ```bash
> baton init --profile github:baton-dx/baton-dx-source/consumer
> ```
>
> This gives your AI tools full context about Baton's CLI, sync workflows, and project management.

> **Using a private source?** Baton auto-detects credentials via SSH keys, GitHub CLI, or environment variables. The quickest setup is `gh auth login`. See [Configuration Reference → Environment Variables](./07-configuration-reference.md#environment-variables) for details.

## Step 3: Initialize Your Project

```bash
cd your-project
baton init
```

The interactive wizard will:
1. Detect installed AI tools and IDEs
2. Let you select a source repository
3. Let you choose profiles to install
4. Create `baton.yaml` in your project

## Step 4: Sync Configurations

```bash
baton sync
```

This resolves all profiles, merges configurations, transforms them for each AI tool, and places files in the correct locations.

After sync, you'll find:
- AI tool configs (`.claude/`, `.cursor/`, etc.)
- IDE settings (`.vscode/`, `.idea/`, etc.)
- Shared files (`.editorconfig`, `.gitignore`, etc.)
- A `baton.lock` file pinning exact versions

## Step 5: Commit and Share

```bash
git add baton.yaml baton.lock
git commit -m "feat: add Baton configuration"
```

Your teammates can now:
```bash
baton sync  # Apply the same configs
```

## What's Next?

- [Creating Sources](./03-creating-sources.md) — Build your own source repository
- [Creating Profiles](./04-creating-profiles.md) — Design profile manifests
- [CLI Reference](./06-cli-reference.md) — All available commands
- [Merge Strategies](./10-merge-strategies.md) — How configs are combined
