import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { FileNotFoundError, SourceNotFoundError } from "../errors.js";
import type { ParsedSource } from "../utils/source-parser.js";

const execFileAsync = promisify(execFile);

/**
 * Validates npm package names to prevent command injection.
 * Allows scoped (@org/pkg) and unscoped names with optional version specifier.
 */
const NPM_PACKAGE_NAME_REGEX =
  /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*(@[^@\s;|&]+)?$/;

/**
 * Validates an npm package name against the safety regex.
 * Throws if the name contains invalid characters or shell metacharacters.
 */
export function validateNpmPackageName(name: string): void {
  if (!NPM_PACKAGE_NAME_REGEX.test(name)) {
    throw new Error(`Invalid npm package name: "${name}"`);
  }
}

export interface NpmResolverOptions {
  /**
   * Parsed NPM source (provider: "npm")
   */
  source: Extract<ParsedSource, { provider: "npm" }>;
  /**
   * Base directory for detecting package manager from lockfile
   * @default process.cwd()
   */
  basePath?: string;
}

export interface ResolvedNpmSource {
  /**
   * Absolute path to the profile directory in node_modules
   */
  localPath: string;
  /**
   * Package manager used for installation (npm, bun, pnpm, yarn)
   */
  packageManager: string;
  /**
   * Version of the installed package
   */
  version: string;
}

/**
 * Package manager detection based on lockfile presence
 */
export type PackageManager = "bun" | "pnpm" | "yarn" | "npm";

/**
 * Resolves an NPM source by installing the package in a temporary directory
 *
 * Features:
 * - Auto-detects package manager from lockfile (bun.lockb, pnpm-lock.yaml, yarn.lock, package-lock.json)
 * - Installs package in temp directory
 * - Searches for baton.profile.yaml in package root or under subpath
 * - Returns absolute path to profile directory
 * - Cleans up temp directory on error
 *
 * @param options - Resolver options including parsed NPM source
 * @returns Resolved source with local path and metadata
 * @throws {Error} if package not found, registry error, or no manifest
 */
export async function resolveNpmSource(options: NpmResolverOptions): Promise<ResolvedNpmSource> {
  const { source, basePath = process.cwd() } = options;

  // Validate package name to prevent command injection
  validateNpmPackageName(source.package);

  // Detect package manager from lockfile
  const packageManager = await detectPackageManager(basePath);

  // Create temporary directory for installation
  const tempDir = await mkdtemp(path.join(tmpdir(), "baton-npm-"));

  try {
    // Initialize package.json in temp dir
    await execFileAsync("npm", ["init", "-y"], { cwd: tempDir });

    // Install the package
    const { command, args } = getInstallCommand(packageManager, source.package);
    try {
      await execFileAsync(command, args, { cwd: tempDir });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Enhanced error messages for common NPM issues
      if (errorMessage.includes("404") || errorMessage.includes("Not Found")) {
        throw new SourceNotFoundError(
          `NPM package not found: ${source.package}. Check that the package exists on the registry.`,
          error,
        );
      }

      if (
        errorMessage.includes("ENOTFOUND") ||
        errorMessage.includes("network") ||
        errorMessage.includes("timeout")
      ) {
        throw new SourceNotFoundError(
          `Network error while installing ${source.package}: ${errorMessage}. Check your internet connection.`,
          error,
        );
      }

      if (errorMessage.includes("EACCES") || errorMessage.includes("permission")) {
        throw new SourceNotFoundError(
          `Permission error while installing ${source.package}: ${errorMessage}. Check directory permissions.`,
          error,
        );
      }

      // Re-throw original error
      throw error;
    }

    // Construct path to installed package
    const packagePath = path.join(tempDir, "node_modules", source.package);

    // Determine profile path (root or subpath)
    const profilePath = source.subpath ? path.join(packagePath, source.subpath) : packagePath;

    // Validate baton.profile.yaml exists
    const manifestPath = path.join(profilePath, "baton.profile.yaml");
    try {
      await access(manifestPath);
    } catch (_error) {
      throw new FileNotFoundError(
        `No baton.profile.yaml found in NPM package: ${source.package}${source.subpath ? `/${source.subpath}` : ""}\nLooked in: ${profilePath}`,
      );
    }

    // Read package version from package.json
    const packageJsonPath = path.join(packagePath, "package.json");
    let version = "unknown";
    try {
      const packageJsonContent = await readFile(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(packageJsonContent);
      version = packageJson.version || "unknown";
    } catch (_error) {
      // Version read failed - continue with "unknown"
    }

    return {
      localPath: profilePath,
      packageManager,
      version,
    };
  } catch (error) {
    // Clean up temp directory on error
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (_cleanupError) {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Detects the package manager from lockfile presence
 * Priority: bun > pnpm > yarn > npm
 */
async function detectPackageManager(basePath: string): Promise<PackageManager> {
  // Check for bun.lockb
  try {
    await access(path.join(basePath, "bun.lockb"));
    return "bun";
  } catch (_error) {
    // Not bun
  }

  // Check for pnpm-lock.yaml
  try {
    await access(path.join(basePath, "pnpm-lock.yaml"));
    return "pnpm";
  } catch (_error) {
    // Not pnpm
  }

  // Check for yarn.lock
  try {
    await access(path.join(basePath, "yarn.lock"));
    return "yarn";
  } catch (_error) {
    // Not yarn
  }

  // Default to npm
  return "npm";
}

/**
 * Returns the install command and arguments for the given package manager.
 * Returns structured data instead of a shell string to prevent command injection.
 */
function getInstallCommand(
  packageManager: PackageManager,
  packageName: string,
): { command: string; args: string[] } {
  switch (packageManager) {
    case "bun":
      return { command: "bun", args: ["add", packageName] };
    case "pnpm":
      return { command: "pnpm", args: ["add", packageName] };
    case "yarn":
      return { command: "yarn", args: ["add", packageName] };
    case "npm":
      return { command: "npm", args: ["install", packageName] };
  }
}
