---
"@baton-dx/cli": minor
"@baton-dx/core": minor
"@baton-dx/ai-tool-paths": minor
---

feat: MCP server distribution support (Issue #80)

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
