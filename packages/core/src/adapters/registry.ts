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

const aiToolAdapterInstances = new Map<string, AIToolAdapter>();
const customPlugins = new Map<string, AIToolAdapter>();
let initialized = false;

function initializeAIToolAdapters(): void {
  if (initialized) return;

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

  for (const [key, plugin] of customPlugins) {
    aiToolAdapterInstances.set(key, plugin);
  }

  initialized = true;
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

export function getAIToolAdaptersForKeys(keys: string[]): AIToolAdapter[] {
  return keys.map((key) => getAIToolAdapter(key));
}

export function registerAIToolPlugin(adapter: AIToolAdapter): void {
  if (!adapter.key || typeof adapter.key !== "string") {
    throw new Error("Plugin adapter must have a valid string 'key' property");
  }
  if (!adapter.name || typeof adapter.name !== "string") {
    throw new Error("Plugin adapter must have a valid string 'name' property");
  }
  if (typeof adapter.isInstalled !== "function") {
    throw new Error("Plugin adapter must implement 'isInstalled()' method");
  }
  if (typeof adapter.getPath !== "function") {
    throw new Error("Plugin adapter must implement 'getPath()' method");
  }

  customPlugins.set(adapter.key, adapter);

  if (initialized) {
    aiToolAdapterInstances.set(adapter.key, adapter);
  }
}

export function unregisterAIToolPlugin(key: string): boolean {
  customPlugins.delete(key);
  return aiToolAdapterInstances.delete(key);
}

export function getRegisteredPluginKeys(): string[] {
  return Array.from(customPlugins.keys());
}

export function isPluginRegistered(key: string): boolean {
  return customPlugins.has(key);
}
