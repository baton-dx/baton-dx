import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import type { ConfigType, Scope } from "@baton-dx/ai-tool-paths";
import type { AIToolAdapter } from "../adapters/types.js";

/**
 * Placement mode for file placement
 * - symlink: First installation creates canonical copy, subsequent AI tools get symlinks
 * - copy: Each AI tool gets an independent copy
 */
export type PlacementMode = "symlink" | "copy";

/**
 * Configuration for placement engine
 */
export interface PlacementConfig {
  /** Placement mode (default: symlink) */
  mode: PlacementMode;
  /** Project root directory (CWD) */
  projectRoot: string;
}

/**
 * File placement result
 */
export interface PlacementResult {
  /** Path where file was placed */
  path: string;
  /** Whether file was created or updated */
  action: "created" | "updated" | "skipped";
  /** Whether file is a symlink */
  isSymlink: boolean;
  /** Reason for fallback when symlink creation failed */
  fallbackReason?: string;
}

/**
 * Canonical file location tracker
 * Tracks where canonical copies are stored for symlink mode
 */
const canonicalFiles = new Map<string, string>();

/**
 * Place a file for a specific AI tool adapter
 *
 * @param content - File content to write
 * @param adapter - AI tool adapter
 * @param type - Config type
 * @param scope - Scope (project or global)
 * @param name - File/directory name
 * @param config - Placement configuration
 * @returns Placement result
 */
export async function placeFile(
  content: string,
  adapter: AIToolAdapter,
  type: ConfigType,
  scope: Scope,
  name: string,
  config: PlacementConfig,
): Promise<PlacementResult> {
  // Get target path from adapter
  const targetPath = adapter.getPath(type, scope, name);

  // Resolve absolute path
  const absolutePath = resolveAbsolutePath(targetPath, scope, config.projectRoot);

  // Ensure parent directory exists
  await mkdir(dirname(absolutePath), { recursive: true });

  // Check if file already exists with same content
  const existingContent = await readFileIfExists(absolutePath);
  if (existingContent === content) {
    return {
      path: absolutePath,
      action: "skipped",
      isSymlink: false,
    };
  }

  // Determine if we should use symlink or copy mode
  // Memory files have different names per agent (CLAUDE.md, AGENTS.md, GEMINI.md)
  // so they should always be independent copies
  const canSymlink = type !== "memory";
  const canonicalKey = `${type}:${name}`;
  const useSymlink = config.mode === "symlink" && canSymlink;

  if (useSymlink) {
    // Check if this is the first installation (canonical copy)
    const existingCanonical = canonicalFiles.get(canonicalKey);

    if (!existingCanonical) {
      // First installation: create canonical copy
      await writeFile(absolutePath, content, "utf-8");
      canonicalFiles.set(canonicalKey, absolutePath);

      return {
        path: absolutePath,
        action: existingContent ? "updated" : "created",
        isSymlink: false,
      };
    }

    // Subsequent installation: create symlink to canonical copy
    try {
      // Calculate relative path from target to canonical
      const relativePath = relative(dirname(absolutePath), existingCanonical);

      // Create symlink
      await symlink(relativePath, absolutePath, "file");

      return {
        path: absolutePath,
        action: "created",
        isSymlink: true,
      };
    } catch (error) {
      // Symlink creation failed, fall back to copy mode
      await writeFile(absolutePath, content, "utf-8");

      return {
        path: absolutePath,
        action: existingContent ? "updated" : "created",
        isSymlink: false,
        fallbackReason: `Failed to create symlink at ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // Copy mode: write independent copy
  await writeFile(absolutePath, content, "utf-8");

  return {
    path: absolutePath,
    action: existingContent ? "updated" : "created",
    isSymlink: false,
  };
}

/**
 * Resolve absolute path based on scope and project root
 *
 * @param path - Path template (may be relative or absolute)
 * @param scope - Scope (project or global)
 * @param projectRoot - Project root directory
 * @returns Absolute path
 */
function resolveAbsolutePath(path: string, scope: Scope, projectRoot: string): string {
  if (scope === "project") {
    // Project scope: resolve relative to project root
    if (isAbsolute(path)) {
      return path;
    }
    return resolve(projectRoot, path);
  }

  // Global scope: path should already be absolute
  if (isAbsolute(path)) {
    return path;
  }

  throw new Error(`Global scope path must be absolute, got relative path: ${path}`);
}

/**
 * Read file content if it exists, return undefined otherwise
 *
 * @param path - File path
 * @returns File content or undefined
 */
async function readFileIfExists(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return undefined;
  }
}

/**
 * Clear canonical file cache (for testing)
 */
export function clearCanonicalCache(): void {
  canonicalFiles.clear();
}
