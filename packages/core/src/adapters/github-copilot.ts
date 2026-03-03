import { BaseAIToolAdapter } from "./base-adapter.js";
import type { McpCapabilities } from "./types.js";

/**
 * GitHub Copilot adapter — uses copilot-instructions.md for memory.
 * Memory path: .github/copilot-instructions.md
 * MCP: .github/mcp.json / ~/.github/mcp.json — "servers" key, env vars expanded
 */
export class GitHubCopilotAdapter extends BaseAIToolAdapter {
    readonly key = "github-copilot";
    readonly name = "GitHub Copilot";
    protected override memoryFilename = "copilot-instructions.md";

    override readonly mcpCapabilities: McpCapabilities = {
        supported: true,
        configKey: "servers",
        envVarSyntax: "expand",
        format: "json",
        sharedSettingsFile: false,
        supportedScopes: ["project", "global"],
    };
}
