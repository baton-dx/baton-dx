/**
 * Central IDE platform registry.
 *
 * Maps IDE platform identifiers (used in baton.profile.yaml `ide:` keys)
 * to their target directories in the project root.
 */

import type { DetectionConfig } from "@baton-dx/agent-paths";

export interface IdePlatformEntry {
  targetDir: string;
  /** Detection methods: CLI binary names or home-relative paths (~/... or .xxx) */
  detection: string[];
  /** Structured detection configuration using OR-of-ANDs logic */
  detectionConfig?: DetectionConfig;
}

/**
 * Registry of known IDE platforms and their target directories.
 *
 * Keys are the platform identifiers used in profile manifests (e.g., `ide.vscode`).
 * Values contain the target directory relative to the project root.
 */
export const idePlatformRegistry: Record<string, IdePlatformEntry> = {
  vscode: { targetDir: ".vscode", detection: ["code", "~/.vscode/"] },
  jetbrains: { targetDir: ".idea", detection: ["idea", "~/.config/JetBrains/"] },
  cursor: { targetDir: ".cursor", detection: ["cursor", "~/.cursor/"] },
  windsurf: { targetDir: ".windsurf", detection: ["windsurf", "~/.windsurf/"] },
  antigravity: { targetDir: ".antigravity", detection: ["antigravity", "~/.antigravity/"] },
  zed: { targetDir: ".config/zed", detection: ["zed", "~/.config/zed/"] },
};

/**
 * Get the target directory for an IDE platform key.
 * Returns undefined if the key is not in the registry.
 */
export function getIdePlatformTargetDir(ideKey: string): string | undefined {
  return idePlatformRegistry[ideKey]?.targetDir;
}

/**
 * Check if an IDE platform key is registered.
 */
export function isKnownIdePlatform(ideKey: string): boolean {
  return ideKey in idePlatformRegistry;
}

/**
 * Get all registered IDE platform keys.
 */
export function getRegisteredIdePlatforms(): string[] {
  return Object.keys(idePlatformRegistry);
}
