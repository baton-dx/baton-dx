import { AdapterNotFoundError } from "../errors.js";
import { AmpAdapter } from "./amp.js";
import { AntigravityAdapter } from "./antigravity.js";
import { ClaudeCodeAdapter } from "./claude-code.js";
import { ClineAdapter } from "./cline.js";
import { CodexAdapter } from "./codex.js";
import { CursorAdapter } from "./cursor.js";
import { GitHubCopilotAdapter } from "./github-copilot.js";
import { JunieAdapter } from "./junie.js";
import { KiroAdapter } from "./kiro.js";
import { OpenCodeAdapter } from "./opencode.js";
import { RooAdapter } from "./roo.js";
import { TraeAdapter } from "./trae.js";
import type { ToolAdapter } from "./types.js";
import { WindsurfAdapter } from "./windsurf.js";
import { ZedAdapter } from "./zed.js";

/**
 * Registry of all tool adapters
 * Singleton instances are created lazily on first access
 */
const adapterInstances = new Map<string, ToolAdapter>();

/**
 * Initialize all adapters
 */
function initializeAdapters(): void {
  if (adapterInstances.size > 0) return; // Already initialized

  const adapters: ToolAdapter[] = [
    new ClaudeCodeAdapter(),
    new CursorAdapter(),
    new WindsurfAdapter(),
    new CodexAdapter(),
    new AntigravityAdapter(),
    new GitHubCopilotAdapter(),
    new OpenCodeAdapter(),
    new AmpAdapter(),
    new KiroAdapter(),
    new ZedAdapter(),
    new ClineAdapter(),
    new RooAdapter(),
    new JunieAdapter(),
    new TraeAdapter(),
  ];

  for (const adapter of adapters) {
    adapterInstances.set(adapter.key, adapter);
  }
}

/**
 * Get adapter instance by tool key
 * @param agentKey - Tool key (e.g., 'claude-code', 'cursor')
 * @returns Adapter instance
 * @throws AdapterNotFoundError if adapter is not registered
 */
export function getAdapter(agentKey: string): ToolAdapter {
  initializeAdapters();

  const adapter = adapterInstances.get(agentKey);
  if (!adapter) {
    throw new AdapterNotFoundError(
      `Adapter not found for tool: ${agentKey}. Available adapters: ${Array.from(adapterInstances.keys()).join(", ")}`,
    );
  }

  return adapter;
}

/**
 * Get all registered adapters
 * @returns Array of all adapter instances
 */
export function getAllAdapters(): ToolAdapter[] {
  initializeAdapters();
  return Array.from(adapterInstances.values());
}

/**
 * Get adapters for the given tool keys
 * @param keys - Array of tool keys
 * @returns Array of adapter instances
 */
export function getAdaptersForKeys(keys: string[]): ToolAdapter[] {
  return keys.map((key) => getAdapter(key));
}
