import { access, copyFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ConfigType } from "@baton-dx/ai-tool-paths";
import { getAIToolAdapter, getAllAIToolAdapters } from "../adapters/registry.js";

/**
 * Legacy file detected in the project
 */
export interface LegacyFile {
  /** Original legacy path */
  legacyPath: string;
  /** Suggested new path */
  newPath: string;
  /** Config type (rules, memory, etc.) */
  configType: ConfigType;
  /** AI tool key */
  toolKey: string;
}

/**
 * Migration action for a legacy file
 */
export type MigrationAction = "migrate" | "copy" | "skip";

/**
 * Migration result for a legacy file
 */
export interface MigrationResult {
  /** Original legacy path */
  legacyPath: string;
  /** New path */
  newPath: string;
  /** Action taken */
  action: MigrationAction;
  /** Success status */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Detect all legacy paths in the project
 *
 * @param projectRoot - Project root directory
 * @returns Array of detected legacy files
 */
export async function detectLegacyPaths(projectRoot: string): Promise<LegacyFile[]> {
  const legacyFiles: LegacyFile[] = [];

  // Get all adapters to check their legacy paths
  const adapters = getAllAIToolAdapters();

  for (const adapter of adapters) {
    // Check each config type for legacy paths
    const configTypes: ConfigType[] = [
      "skills",
      "rules",
      "agents",
      "memory",
      "settings",
      "commands",
    ];

    for (const configType of configTypes) {
      const legacyPaths = adapter.getLegacyPaths(configType);

      for (const legacyPath of legacyPaths) {
        const absoluteLegacyPath = resolve(projectRoot, legacyPath);

        // Check if legacy file exists
        try {
          await access(absoluteLegacyPath);

          // Get new path from adapter
          // For files, extract filename from legacy path
          const filename = legacyPath.split("/").pop() || legacyPath;
          const newPath = adapter.getPath(configType, "project", filename);

          legacyFiles.push({
            legacyPath: absoluteLegacyPath,
            newPath: resolve(projectRoot, newPath),
            configType,
            toolKey: adapter.key,
          });
        } catch {}
      }
    }
  }

  return legacyFiles;
}

/**
 * Migrate a legacy file
 *
 * @param legacyFile - Legacy file to migrate
 * @param action - Migration action (migrate, copy, skip)
 * @returns Migration result
 */
export async function migrateLegacyFile(
  legacyFile: LegacyFile,
  action: MigrationAction,
): Promise<MigrationResult> {
  if (action === "skip") {
    return {
      legacyPath: legacyFile.legacyPath,
      newPath: legacyFile.newPath,
      action: "skip",
      success: true,
    };
  }

  try {
    // Check if legacy file is a directory or file
    const legacyStats = await stat(legacyFile.legacyPath);
    const isDirectory = legacyStats.isDirectory();

    if (isDirectory) {
      // Copy entire directory
      await copyDirectory(legacyFile.legacyPath, legacyFile.newPath);
    } else {
      // Ensure parent directory exists
      const parentDir = legacyFile.newPath.split("/").slice(0, -1).join("/");
      await mkdir(parentDir, { recursive: true });

      // Copy file to new location
      await copyFile(legacyFile.legacyPath, legacyFile.newPath);
    }

    // If action is migrate (not copy), remove the old file
    if (action === "migrate") {
      await rm(legacyFile.legacyPath, { recursive: true, force: true });
    }

    return {
      legacyPath: legacyFile.legacyPath,
      newPath: legacyFile.newPath,
      action,
      success: true,
    };
  } catch (error) {
    return {
      legacyPath: legacyFile.legacyPath,
      newPath: legacyFile.newPath,
      action,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Copy a directory recursively
 *
 * @param src - Source directory
 * @param dest - Destination directory
 */
async function copyDirectory(src: string, dest: string): Promise<void> {
  // Create destination directory
  await mkdir(dest, { recursive: true });

  // Read source directory
  const entries = await readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      // Recursively copy subdirectory
      await copyDirectory(srcPath, destPath);
    } else {
      // Copy file
      await copyFile(srcPath, destPath);
    }
  }
}

/**
 * Get the most conservative migration action (copy)
 * Used when --yes flag is set
 *
 * @returns Copy action
 */
export function getConservativeAction(): MigrationAction {
  return "copy";
}

/**
 * Migrate specific legacy paths
 * Handles common legacy paths like .cursorrules and .windsurfrules
 *
 * @param projectRoot - Project root directory
 * @returns Array of migration results
 */
export async function migrateCommonLegacyPaths(projectRoot: string): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  // .cursorrules -> .cursor/rules/
  const cursorrules = resolve(projectRoot, ".cursorrules");
  try {
    await access(cursorrules);
    const cursorAdapter = getAIToolAdapter("cursor");
    const newPath = cursorAdapter.getPath("rules", "project", "cursorrules.md");

    const result = await migrateLegacyFile(
      {
        legacyPath: cursorrules,
        newPath: resolve(projectRoot, newPath),
        configType: "rules",
        toolKey: "cursor",
      },
      "copy",
    );
    results.push(result);
  } catch {
    // .cursorrules doesn't exist, skip
  }

  // .windsurfrules -> .windsurf/rules/
  const windsurfrules = resolve(projectRoot, ".windsurfrules");
  try {
    await access(windsurfrules);
    const windsurfAdapter = getAIToolAdapter("windsurf");
    const newPath = windsurfAdapter.getPath("rules", "project", "windsurfrules.md");

    const result = await migrateLegacyFile(
      {
        legacyPath: windsurfrules,
        newPath: resolve(projectRoot, newPath),
        configType: "rules",
        toolKey: "windsurf",
      },
      "copy",
    );
    results.push(result);
  } catch {
    // .windsurfrules doesn't exist, skip
  }

  return results;
}
