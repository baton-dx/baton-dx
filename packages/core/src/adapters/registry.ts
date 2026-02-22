import { AIToolAdapterNotFoundError } from "../errors.js";
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
import type { AIToolAdapter } from "./types.js";
import { WindsurfAdapter } from "./windsurf.js";
import { ZedAdapter } from "./zed.js";

/**
 * Registry of all tool adapters
 * Singleton instances are created lazily on first access
 */
const aiToolAdapterInstances = new Map<string, AIToolAdapter>();

/**
 * Initialize all adapters
 */
function initializeAIToolAdapters(): void {
  if (aiToolAdapterInstances.size > 0) return; // Already initialized

  const adapters: AIToolAdapter[] = [
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
    aiToolAdapterInstances.set(adapter.key, adapter);
  }
}

/**
 * Get adapter instance by tool key
 * @param toolKey - Tool key (e.g., 'claude-code', 'cursor')
 * @returns Adapter instance
 * @throws AIToolAdapterNotFoundError if adapter is not registered
 */
export function getAIToolAdapter(toolKey: string): AIToolAdapter {
  initializeAIToolAdapters();

  const adapter = aiToolAdapterInstances.get(toolKey);
  if (!adapter) {
    throw new AIToolAdapterNotFoundError(
      `Adapter not found for tool: ${toolKey}. Available adapters: ${Array.from(aiToolAdapterInstances.keys()).join(", ")}`,
    );
  }

  return adapter;
}

/**
 * Get all registered adapters
 * @returns Array of all adapter instances
 */
export function getAllAIToolAdapters(): AIToolAdapter[] {
  initializeAIToolAdapters();
  return Array.from(aiToolAdapterInstances.values());
}

/**
 * Get adapters for the given tool keys
 * @param keys - Array of tool keys
 * @returns Array of adapter instances
 */
export function getAIToolAdaptersForKeys(keys: string[]): AIToolAdapter[] {
  return keys.map((key) => getAIToolAdapter(key));
}
