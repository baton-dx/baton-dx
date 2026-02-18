import { access, realpath } from "node:fs/promises";
import path from "node:path";
import { FileNotFoundError, SourceNotFoundError } from "../errors.js";

export interface FileResolverOptions {
  /**
   * The file path to resolve (relative or absolute)
   */
  filePath: string;
  /**
   * Base directory for resolving relative paths
   * @default process.cwd()
   */
  basePath?: string;
}

export interface ResolvedFilePath {
  /**
   * Absolute, canonical path to the profile directory
   */
  absolutePath: string;
  /**
   * Whether the path is a symlink
   */
  isSymlink: boolean;
  /**
   * Original path provided by user
   */
  originalPath: string;
}

/**
 * Resolves a file: source to an absolute path
 *
 * - Supports relative paths (./profile, ../shared-profile)
 * - Supports absolute paths (/Users/dev/profiles/minimal)
 * - Follows symlinks via fs.realpath
 * - Validates path exists and contains baton.profile.yaml
 *
 * @throws {SourceNotFoundError} if path does not exist
 * @throws {SourceNotFoundError} if symlink resolution fails
 * @throws {FileNotFoundError} if path does not contain baton.profile.yaml
 */
export async function resolveFileSource(options: FileResolverOptions): Promise<ResolvedFilePath> {
  const { filePath, basePath = process.cwd() } = options;

  // Resolve relative paths
  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(basePath, filePath);

  // Check if path exists
  try {
    await access(resolvedPath);
  } catch (_error) {
    throw new SourceNotFoundError(
      `File source path does not exist: ${filePath}\nResolved to: ${resolvedPath}`,
    );
  }

  // Follow symlinks to get canonical path
  let canonicalPath: string;
  let isSymlink = false;
  try {
    canonicalPath = await realpath(resolvedPath);
    isSymlink = canonicalPath !== resolvedPath;
  } catch (error) {
    throw new SourceNotFoundError(`Failed to resolve symlink for path: ${resolvedPath}`, error);
  }

  // Validate baton.profile.yaml exists in the resolved path
  const manifestPath = path.join(canonicalPath, "baton.profile.yaml");
  try {
    await access(manifestPath);
  } catch (_error) {
    throw new FileNotFoundError(
      `No baton.profile.yaml found in file source: ${filePath}\nResolved to: ${canonicalPath}`,
    );
  }

  return {
    absolutePath: canonicalPath,
    isSymlink,
    originalPath: filePath,
  };
}
