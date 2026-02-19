/**
 * Central IDE platform registry.
 *
 * Maps IDE platform identifiers (used in baton.profile.yaml `ide:` keys)
 * to their target directories in the project root.
 */

import type { DetectionConfig } from "@baton-dx/agent-paths";

export interface IdePlatformEntry {
  targetDir: string;
  /** Structured detection configuration using OR-of-ANDs logic */
  detectionConfig: DetectionConfig;
}

/**
 * Registry of known IDE platforms and their target directories.
 *
 * Keys are the platform identifiers used in profile manifests (e.g., `ide.vscode`).
 * Values contain the target directory relative to the project root.
 */
export const idePlatformRegistry: Record<string, IdePlatformEntry> = {
  vscode: {
    targetDir: ".vscode",
    detectionConfig: {
      groups: [
        [{ type: "binary", name: "code" }],
        [{ type: "app", name: "Visual Studio Code.app" }],
        [{ type: "directory", path: "~/.vscode/", markerFile: "extensions" }],
      ],
    },
  },
  jetbrains: {
    targetDir: ".idea",
    detectionConfig: {
      groups: [
        [{ type: "binary", name: "idea" }],
        [
          {
            type: "directory",
            path: "~/.config/JetBrains/",
            platforms: ["linux"],
          },
        ],
        [
          {
            type: "directory",
            path: "~/Library/Application Support/JetBrains/",
            platforms: ["darwin"],
          },
        ],
      ],
    },
  },
  cursor: {
    targetDir: ".cursor",
    detectionConfig: {
      groups: [
        [{ type: "binary", name: "cursor" }],
        [{ type: "app", name: "Cursor.app" }],
        [{ type: "directory", path: "~/.cursor/", markerFile: "extensions" }],
      ],
    },
  },
  windsurf: {
    targetDir: ".windsurf",
    detectionConfig: {
      groups: [
        [{ type: "binary", name: "windsurf" }],
        [{ type: "app", name: "Windsurf.app" }],
        [
          {
            type: "directory",
            path: "~/.windsurf/",
            markerFile: "extensions",
          },
        ],
      ],
    },
  },
  antigravity: {
    targetDir: ".antigravity",
    detectionConfig: {
      groups: [
        [{ type: "binary", name: "agy" }],
        [{ type: "binary", name: "antigravity" }],
        [{ type: "app", name: "Antigravity.app" }],
      ],
    },
  },
  zed: {
    targetDir: ".config/zed",
    detectionConfig: {
      groups: [
        [{ type: "binary", name: "zed" }],
        [{ type: "app", name: "Zed.app" }],
        [
          {
            type: "directory",
            path: "~/.config/zed/",
            markerFile: "settings.json",
          },
        ],
      ],
    },
  },
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
