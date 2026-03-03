import { BaseAIToolAdapter } from "./base-adapter.js";
import type { McpCapabilities } from "./types.js";

/**
 * OpenCode adapter — uses canonical formats with AGENTS.md for memory.
 * Global paths: ~/.config/opencode/ (XDG Base Directory)
 * MCP: .opencode/mcp.jsonc / ~/.config/opencode/mcp.jsonc — "mcp" key, {env:VAR} syntax
 */
export class OpenCodeAdapter extends BaseAIToolAdapter {
    readonly key = "opencode";
    readonly name = "OpenCode";

    override readonly mcpCapabilities: McpCapabilities = {
        supported: true,
        configKey: "mcp",
        envVarSyntax: "env-colon",
        format: "jsonc",
        sharedSettingsFile: false,
        supportedScopes: ["project", "global"],
    };
}
