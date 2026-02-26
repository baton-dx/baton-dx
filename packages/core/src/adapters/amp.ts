import { BaseAIToolAdapter } from "./base-adapter.js";
import type { McpCapabilities } from "./types.js";

/**
 * Amp adapter — uses canonical formats with AGENTS.md for memory.
 * Project paths: .agents/ | Global paths: ~/.config/agents/
 * MCP: .amp/mcp.json / ~/.config/amp/mcp.json — "amp.mcpServers" nested key, ${VAR} env syntax
 */
export class AmpAdapter extends BaseAIToolAdapter {
  readonly key = "amp";
  readonly name = "Amp";

  override readonly mcpCapabilities: McpCapabilities = {
    supported: true,
    configKey: "mcpServers",
    parentConfigPath: "amp",
    envVarSyntax: "dollar-brace",
    format: "json",
    sharedSettingsFile: false,
    supportedScopes: ["project", "global"],
  };
}
