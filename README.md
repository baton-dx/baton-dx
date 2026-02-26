# Baton DX <sub>/bəˈtɑːn/</sub>

[![npm version](https://img.shields.io/npm/v/@baton-dx/cli.svg)](https://www.npmjs.com/package/@baton-dx/cli)
[![CI Status](https://github.com/baton-dx/baton-dx/workflows/CI/badge.svg)](https://github.com/baton-dx/baton-dx/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Baton is a CLI package manager for Developer Experience & AI configuration.** Manage Skills, Rules, Agents, Memory Files, and file configs as versioned, composable profiles for 14 AI coding tools.

## Why Baton?

| | Without Baton | With Baton |
|---|---|---|
| **Setup** | Manually copy and adapt config files for each AI tool | `baton init` + `baton sync` — done in seconds |
| **Team Consistency** | Config drift — every dev diverges over time | One source of truth, version-locked with `baton.lock` |
| **Cross-Project** | Each repo has its own ad-hoc AI configs, no shared standard | Same profiles across all your projects — consistent by default |
| **Multiple Tools** | Even 2–3 AI tools mean 2–3 different formats to maintain | One manifest, automatically transformed per tool |
| **Onboarding** | New devs spend hours recreating the "right" AI setup | `baton sync` — match the team instantly |

**Without Baton** — manual config per project, per tool:

```mermaid
graph TB
    D("Developer"):::person --> P1("Project A"):::project
    D --> P2("Project B"):::project
    D --> P3("Project C"):::project

    P1 --> T1A("Claude Code"):::config
    P1 --> T1B("Cursor"):::config
    P1 --> T1C("Copilot"):::config

    P2 --> T2A("Claude Code"):::config
    P2 --> T2B("Cursor"):::config
    P2 --> T2C("Copilot"):::config

    P3 --> T3A("Claude Code"):::config
    P3 --> T3B("Cursor"):::config
    P3 --> T3C("Copilot"):::config

    classDef person fill:#fee2e2,stroke:#fca5a5,color:#991b1b,stroke-width:2px
    classDef project fill:#fff7ed,stroke:#fdba74,color:#9a3412,stroke-width:2px
    classDef config fill:#fef2f2,stroke:#fca5a5,color:#b91c1c,stroke-width:1px

    linkStyle default stroke:#f87171,stroke-width:1.5px
```

**With Baton** — one source, every project in sync:

```mermaid
graph TB
    S("Source Repo"):::source -->|"baton sync"| P1("Project A"):::project
    S -->|"baton sync"| P2("Project B"):::project
    S -->|"baton sync"| P3("Project C"):::project

    P1 --> T1("All tools configured"):::done
    P2 --> T2("All tools configured"):::done
    P3 --> T3("All tools configured"):::done

    classDef source fill:#dcfce7,stroke:#86efac,color:#166534,stroke-width:2px
    classDef project fill:#f0fdf4,stroke:#86efac,color:#166534,stroke-width:2px
    classDef done fill:#bbf7d0,stroke:#4ade80,color:#14532d,stroke-width:2px

    linkStyle default stroke:#4ade80,stroke-width:1.5px
```

Baton currently supports 14 AI coding tools — see the [full list below](#supported-ai-tools).

## Quick Start

```bash
# Install
bun install -g @baton-dx/cli

# Connect your team's source repository
baton source connect github:your-org/dx-configs --name my-team

# Initialize in any project
baton init

# Sync all configurations
baton sync
```

## Features

- **Unified AI Configuration** — One manifest for 14 AI coding tools
- **MCP Server Distribution** — Define MCP servers once, placed into each tool's native config format
- **Profile Inheritance** — Compose profiles with `extends` for layered configuration
- **Smart Sync** — Transform and place files in the correct format for each tool
- **Version Control** — Lockfile-based reproducibility with SHA-256 integrity
- **Merge Strategies** — replace, deep, append, prepend, skip, prompt, directory, import
- **Auto-Detection** — Automatically detect installed AI tools and IDEs
- **Scaffold Templates** — Bootstrap source repositories with `baton source create`

## Supported AI Tools

| Tool | Key | Tool | Key |
|------|-----|------|-----|
| Claude Code | `claude-code` | OpenCode | `opencode` |
| Cursor | `cursor` | Amp | `amp` |
| Windsurf | `windsurf` | Kiro | `kiro` |
| Antigravity | `antigravity` | Zed | `zed` |
| Codex CLI | `codex` | Cline | `cline` |
| GitHub Copilot | `github-copilot` | Roo | `roo` |
| Junie | `junie` | Trae | `trae` |

## Official Source Repository

Baton's own configurations are published as [`baton-dx-source`](https://github.com/baton-dx/baton-dx-source) — a real-world example of sources and profiles in action:

| Profile | Command | Audience |
| ------- | ------- | -------- |
| **maintainer** | `baton init --profile github:baton-dx/baton-dx-source/maintainer` | Contributors to this repo |
| **creator** | `baton init --profile github:baton-dx/baton-dx-source/creator` | Developers building their own sources and profiles |
| **consumer** | `baton init --profile github:baton-dx/baton-dx-source/consumer` | Developers using Baton in their projects |

## Documentation

- [Installation](docs/01-installation.md) — Prerequisites and install methods
- [Quick Start Guide](docs/02-quickstart.md) — Get running in 5 minutes
- [Creating Sources](docs/03-creating-sources.md) — Build source repositories
- [Creating Profiles](docs/04-creating-profiles.md) — Design profile manifests
- [Using Profiles](docs/05-using-profiles.md) — Use profiles in your projects
- [CLI Reference](docs/06-cli-reference.md) — Complete command reference
- [Configuration Reference](docs/07-configuration-reference.md) — All config file schemas
- [AI Tools Reference](docs/08-ai-tools-reference.md) — All 14 supported AI tools
- [IDE Platforms](docs/09-ide-platforms-reference.md) — Supported IDE platforms
- [Merge Strategies](docs/10-merge-strategies.md) — Deep dive into merge strategies

## Built with AI, Verified by Humans

Baton is proudly built with the help of AI tools. We believe AI-assisted development is a powerful accelerator — and as a tool that manages AI coding configurations, we practice what we preach. At the same time, human review, testing, and judgment are essential for every contribution. We do not accept pull requests from fully autonomous bots (e.g., OpenClaw).

## Contributing

See [Contributing Guide](docs/11-contributing.md) for development setup, coding conventions, and PR workflow.

## License

MIT © 2026 Baton Contributors
