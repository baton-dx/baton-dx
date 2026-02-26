import { BaseAIToolAdapter } from "./base-adapter.js";
import type { McpCapabilities } from "./types.js";

/**
 * Kiro adapter — uses canonical formats with AGENTS.md for memory.
 * Project paths: .kiro/ | Global paths: ~/.kiro/
 * MCP: .kiro/mcp.json / ~/.kiro/mcp.json — "mcpServers" key, ${VAR} env syntax
 */
export class KiroAdapter extends BaseAIToolAdapter {
  readonly key = "kiro";
  readonly name = "Kiro";

  override readonly mcpCapabilities: McpCapabilities = {
    supported: true,
    configKey: "mcpServers",
    envVarSyntax: "dollar-brace",
    format: "json",
    sharedSettingsFile: false,
    supportedScopes: ["project", "global"],
  };
}
