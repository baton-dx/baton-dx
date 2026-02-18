# Installation

## Prerequisites

- **Node.js** ≥ 20
- **Git** (for source resolution)
- One of: bun, npm, pnpm, or yarn

## Install via Homebrew (macOS/Linux)

(Recommended for end users)

```bash
brew tap baton-dx/baton-dx https://github.com/baton-dx/baton-dx
brew install baton-dx
```

## Install via Package Manager

```bash
# bun (recommended)
bun install -g @baton-dx/cli

# npm
npm install -g @baton-dx/cli

# pnpm
pnpm install -g @baton-dx/cli

# yarn
yarn global add @baton-dx/cli
```

## Run Without Installing

```bash
npx @baton-dx/cli init
bunx @baton-dx/cli init
```

## Verify Installation

```bash
baton --version
baton --help
```

> **Tip:** Baton is also available as `baton-dx` and `btx` — all three commands are identical aliases. Use whichever you prefer.

## First-Time Setup

After installation, scan for installed AI tools and IDEs:

```bash
# Detect and save installed AI tools
baton ai-tools scan

# Detect and save IDE platforms
baton ides scan
```

Optionally register a team source repository for reuse across projects:

```bash
baton source connect github:your-org/dx-configs --name my-team
```

## Development Installation

For contributing to Baton:

```bash
git clone https://github.com/baton-dx/baton-dx.git
cd baton-dx
bun install
bun run build
bun link --cwd packages/cli
```
