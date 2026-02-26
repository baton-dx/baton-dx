import { BaseAIToolAdapter } from "./base-adapter.js";
import type { McpCapabilities } from "./types.js";

/**
 * Trae adapter — uses canonical formats with AGENTS.md for memory.
 * Project paths: .trae/ | Global paths: ~/.trae/
 * MCP: .trae/mcp.json / ~/.trae/mcp.json — "mcpServers" key, env vars expanded
 */
export class TraeAdapter extends BaseAIToolAdapter {
  readonly key = "trae";
  readonly name = "Trae";

  override readonly mcpCapabilities: McpCapabilities = {
    supported: true,
    configKey: "mcpServers",
    envVarSyntax: "expand",
    format: "json",
    sharedSettingsFile: false,
    supportedScopes: ["project", "global"],
  };
}
