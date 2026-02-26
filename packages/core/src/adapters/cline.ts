import { BaseAIToolAdapter } from "./base-adapter.js";
import type { McpCapabilities } from "./types.js";

/**
 * Cline adapter — uses canonical formats with AGENTS.md for memory.
 * Project paths: .cline/ | Global paths: ~/.cline/
 * MCP: ~/.cline/mcp.json (global-only, shared) — "mcpServers" key, env vars expanded
 */
export class ClineAdapter extends BaseAIToolAdapter {
  readonly key = "cline";
  readonly name = "Cline";

  override readonly mcpCapabilities: McpCapabilities = {
    supported: true,
    configKey: "mcpServers",
    envVarSyntax: "expand",
    format: "json",
    sharedSettingsFile: true,
    supportedScopes: ["global"],
  };
}
