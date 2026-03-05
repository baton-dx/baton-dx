# @baton-dx/agent-paths

## 0.14.8

## 0.14.7

## 0.14.6

## 0.14.5

## 0.14.4

## 0.14.3

## 0.14.2

## 0.14.1

## 0.14.0

### Minor Changes

- [#126](https://github.com/baton-dx/baton-dx/pull/126) [`7c51ac2`](https://github.com/baton-dx/baton-dx/commit/7c51ac2f392d1ed6aac8d6d42c30e4039ad1cfd2) Thanks [@mantaray0](https://github.com/mantaray0)! - feat: MCP server distribution support (Issue #80)

  Define MCP servers once in `ai.mcp[]` inside `baton.profile.yaml` — Baton places them into each tool's native config format during `baton sync`.

  **New profile syntax:**

  ```yaml
  ai:
    mcp:
      - name: filesystem
        transport: stdio
        command: npx
        args: ["-y", "@modelcontextprotocol/server-filesystem"]
        env:
          ROOT_DIR: "${HOME}"
        scope: project
      - name: github
        transport: http
        url: https://api.githubcopilot.com/mcp/
        scope: global
  ```

  **Supported across all 13 tools** (Junie excluded — no MCP support):

  - Dedicated JSON files: Claude Code, Cursor, Kiro, Roo, Amp, GitHub Copilot, Trae, OpenCode (JSONC)
  - Shared settings files (read-modify-write): Zed (`settings.json`), Cline, Antigravity, Codex CLI (TOML)

  **Env-var transformation:** `${VAR}` syntax in `env` fields is transformed to each tool's native syntax at sync time.

  **State tracking:** Previously placed MCP servers are tracked in `.baton/state.yaml` so stale servers are removed on the next sync.

## 0.13.1

## 0.13.0

## 0.12.1

## 0.12.0

## 0.11.0

## 0.10.1

## 0.10.0

## 0.9.2

## 0.9.1

## 0.9.0

## 0.8.3

## 0.8.2

### Patch Changes

- [#74](https://github.com/baton-dx/baton-dx/pull/74) [`c5923a4`](https://github.com/baton-dx/baton-dx/commit/c5923a4eb08c19f746c9cbd5ba3453fc99a153ab) Thanks [@mantaray0](https://github.com/mantaray0)! - Stop gitignoring project files (e.g. biome.json, .editorconfig) placed by profiles — they should be committed so the project works without Baton.

## 0.8.1

### Patch Changes

- [#71](https://github.com/baton-dx/baton-dx/pull/71) [`8272e28`](https://github.com/baton-dx/baton-dx/commit/8272e28fa7ba20a835d50dbf2b99a5743b9faf6b) Thanks [@mantaray0](https://github.com/mantaray0)! - Remove unused `merge` field from file config items in profile manifest schema. Files are deduplicated by target path (last-wins by weight), not merged. Merge strategies only apply to memory items.

## 0.1.1
