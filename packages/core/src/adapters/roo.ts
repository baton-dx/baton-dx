import { BaseAIToolAdapter } from "./base-adapter.js";
import type { McpCapabilities } from "./types.js";

/**
 * Roo adapter — uses canonical formats with AGENTS.md for memory.
 * Project paths: .roo/ | Global paths: ~/.roo/
 * MCP: .roo/mcp.json / ~/.roo/mcp.json — "mcpServers" key, ${env:VAR} syntax
 */
export class RooAdapter extends BaseAIToolAdapter {
  readonly key = "roo";
  readonly name = "Roo";

  override readonly mcpCapabilities: McpCapabilities = {
    supported: true,
    configKey: "mcpServers",
    envVarSyntax: "dollar-env-colon",
    format: "json",
    sharedSettingsFile: false,
    supportedScopes: ["project", "global"],
  };
}
