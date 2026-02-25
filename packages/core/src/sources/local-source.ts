import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { FileNotFoundError, SourceNotFoundError } from "../errors.js";

export interface LoadLocalSourceOptions {
  /**
   * The local path to load from (can be relative or absolute)
   */
  path: string;

  /**
   * The base directory to resolve relative paths from
   * (typically the directory containing baton.yaml)
   */
  baseDir: string;
}

export interface LocalSource {
  /**
   * The resolved absolute path to the local source
   */
  resolvedPath: string;

  /**
   * Integrity hashes for all files in the source (file path -> SHA-256)
   * Used for lockfile generation
   */
  integrity: Record<string, string>;
}

/**
 * Resolves a local path to an absolute path
 *
 * - Absolute paths are returned as-is
 * - Relative paths are resolved relative to baseDir
 */
export function resolveLocalPath(path: string, baseDir: string): string {
  if (isAbsolute(path)) {
    return path;
  }

  return resolve(baseDir, path);
}

/**
 * Recursively scans a directory and generates SHA-256 integrity hashes for all files
 */
async function generateIntegrityHashes(
  dirPath: string,
  basePath: string = dirPath,
): Promise<Record<string, string>> {
  const integrity: Record<string, string> = {};

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively process subdirectories
        const subIntegrity = await generateIntegrityHashes(fullPath, basePath);
        Object.assign(integrity, subIntegrity);
      } else if (entry.isFile()) {
        // Generate SHA-256 hash for file
        const content = await readFile(fullPath);
        const hash = createHash("sha256").update(content).digest("hex");

        // Store with relative path from base
        const relativePath = fullPath.substring(basePath.length + 1);
        integrity[relativePath] = hash;
      }
    }
  } catch (error) {
    throw new FileNotFoundError(
      `Failed to read directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  return integrity;
}

/**
 * Loads a local source from the filesystem
 *
 * This function:
 * 1. Resolves the path (relative paths are resolved relative to baseDir)
 * 2. Verifies the path exists
 * 3. Generates SHA-256 integrity hashes for all files (for lockfile)
 *
 * Local sources are NOT cached - they are always read fresh from disk.
 *
 * @param options - Load options with path and baseDir
 * @returns LocalSource with resolved path and integrity hashes
 * @throws SourceNotFoundError if the path doesn't exist
 */
export async function loadLocalSource(options: LoadLocalSourceOptions): Promise<LocalSource> {
  const { path, baseDir } = options;

  // Resolve path (absolute or relative to baseDir)
  const resolvedPath = resolveLocalPath(path, baseDir);

  // Verify path exists
  try {
    const stats = await stat(resolvedPath);
    if (!stats.isDirectory()) {
      throw new SourceNotFoundError(`Local source path is not a directory: ${resolvedPath}`);
    }
  } catch (error) {
    if (error instanceof SourceNotFoundError) {
      throw error;
    }
    throw new SourceNotFoundError(`Local source not found: ${resolvedPath}`, { cause: error });
  }

  // Generate integrity hashes for all files
  const integrity = await generateIntegrityHashes(resolvedPath);

  return {
    resolvedPath,
    integrity,
  };
}
