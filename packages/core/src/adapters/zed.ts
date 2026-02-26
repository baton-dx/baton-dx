import { BaseAIToolAdapter } from "./base-adapter.js";
import type { McpCapabilities } from "./types.js";

/**
 * Zed adapter — uses canonical formats with AGENTS.md for memory.
 * Project paths: .zed/ | Global paths: ~/.zed/
 * MCP: ~/.config/zed/settings.json (shared) — "context_servers" key, env vars expanded
 */
export class ZedAdapter extends BaseAIToolAdapter {
  readonly key = "zed";
  readonly name = "Zed";

  override readonly mcpCapabilities: McpCapabilities = {
    supported: true,
    configKey: "context_servers",
    envVarSyntax: "expand",
    format: "json",
    sharedSettingsFile: true,
    supportedScopes: ["global"],
  };
}
