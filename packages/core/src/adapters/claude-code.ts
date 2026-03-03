import { BaseAIToolAdapter } from "./base-adapter.js";
import type { McpCapabilities } from "./types.js";

/**
 * Claude Code adapter — reference implementation for AIToolAdapter interface.
 *
 * Uses canonical formats:
 * - Skills: 1:1 copy (SKILL.md with optional scripts/)
 * - Rules: .md with optional YAML frontmatter (paths:)
 * - Agents: .md with full YAML frontmatter
 * - Memory: CLAUDE.md or .claude/CLAUDE.md
 * - Commands: .claude/commands/{name}.md
 * - MCP: .mcp.json / ~/.claude/mcp.json — "mcpServers" key, ${VAR} env syntax
 */
export class ClaudeCodeAdapter extends BaseAIToolAdapter {
    readonly key = "claude-code";
    readonly name = "Claude Code";
    protected override memoryFilename = "CLAUDE.md";

    override readonly mcpCapabilities: McpCapabilities = {
        supported: true,
        configKey: "mcpServers",
        envVarSyntax: "dollar-brace",
        format: "json",
        sharedSettingsFile: false,
        supportedScopes: ["project", "global"],
    };
}
