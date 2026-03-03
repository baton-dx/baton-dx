import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
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

const NPM_CACHE_DIR = path.join(homedir(), ".baton", "cache", "npm");

/**
 * Generates a cache key from an NPM source (package + subpath).
 * Returns a 16-character hex string from SHA-256.
 */
function getNpmCacheKey(source: Extract<ParsedSource, { provider: "npm" }>): string {
    const normalized = `npm:${source.package}${source.subpath ? `/${source.subpath}` : ""}`;
    return createHash("sha256").update(normalized).digest("hex").substring(0, 16);
}

/**
 * Gets the full cache directory path for a given NPM source.
 */
function getNpmCachePath(source: Extract<ParsedSource, { provider: "npm" }>): string {
    const key = getNpmCacheKey(source);
    return path.join(NPM_CACHE_DIR, key);
}

/**
 * Metadata stored alongside cached NPM packages.
 */
export interface NpmCacheMeta {
    version: string;
    installedAt: number;
    package: string;
    subpath?: string;
}

const CACHE_META_FILENAME = ".baton-npm-meta.json";

/**
 * Reads cache metadata from a cache directory.
 * Returns null if the metadata file doesn't exist or is invalid.
 */
async function readCacheMeta(cachePath: string): Promise<NpmCacheMeta | null> {
    try {
        const metaPath = path.join(cachePath, CACHE_META_FILENAME);
        const content = await readFile(metaPath, "utf-8");
        const meta = JSON.parse(content) as NpmCacheMeta;
        // Basic validation: ensure required fields exist
        if (
            meta &&
            typeof meta.version === "string" &&
            typeof meta.installedAt === "number" &&
            typeof meta.package === "string"
        ) {
            return meta;
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Writes cache metadata to a cache directory.
 */
async function writeCacheMeta(cachePath: string, meta: NpmCacheMeta): Promise<void> {
    const metaPath = path.join(cachePath, CACHE_META_FILENAME);
    await writeFile(metaPath, JSON.stringify(meta, null, 2), "utf-8");
}

/**
 * Checks if cached metadata is stale based on age.
 */
function isCacheStale(meta: NpmCacheMeta, maxAgeMs: number): boolean {
    return Date.now() - meta.installedAt > maxAgeMs;
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
    /**
     * Whether to use the persistent cache. Defaults to true.
     */
    useCache?: boolean;
    /**
     * Maximum age of cached packages in milliseconds.
     * If not set, cache never expires based on age.
     */
    maxCacheAgeMs?: number;
}

export interface ResolvedNpmSource {
    /**
     * Absolute path to the profile directory in node_modules
     */
    localPath: string;
    /**
     * Package manager used for installation (npm, bun, pnpm, yarn, cached)
     */
    packageManager: string;
    /**
     * Version of the installed package
     */
    version: string;
    /**
     * Whether the result was served from the persistent cache
     */
    fromCache: boolean;
}

/**
 * Package manager detection based on lockfile presence
 */
export type PackageManager = "bun" | "pnpm" | "yarn" | "npm";

/**
 * Resolves an NPM source by installing the package, with persistent caching.
 *
 * Features:
 * - Persistent cache in ~/.baton/cache/npm/<hash>/
 * - Auto-detects package manager from lockfile (bun.lockb, pnpm-lock.yaml, yarn.lock, package-lock.json)
 * - Installs package in cache directory
 * - Searches for baton.profile.yaml in package root or under subpath
 * - Returns absolute path to profile directory
 * - Cleans up cache dir on error
 *
 * @param options - Resolver options including parsed NPM source
 * @returns Resolved source with local path and metadata
 * @throws {Error} if package not found, registry error, or no manifest
 */
export async function resolveNpmSource(options: NpmResolverOptions): Promise<ResolvedNpmSource> {
    const { source, basePath = process.cwd(), useCache = true, maxCacheAgeMs } = options;

    // Validate package name to prevent command injection
    validateNpmPackageName(source.package);

    const cachePath = getNpmCachePath(source);

    // Check cache first when useCache is enabled
    if (useCache) {
        const meta = await readCacheMeta(cachePath);
        if (meta) {
            // Check staleness if maxAgeMs is configured
            const stale = maxCacheAgeMs !== undefined && isCacheStale(meta, maxCacheAgeMs);

            if (!stale) {
                // Validate that the manifest still exists in cache
                const packagePath = path.join(cachePath, "node_modules", source.package);
                const profilePath = source.subpath
                    ? path.join(packagePath, source.subpath)
                    : packagePath;
                const manifestPath = path.join(profilePath, "baton.profile.yaml");

                try {
                    await access(manifestPath);
                    return {
                        localPath: profilePath,
                        packageManager: "cached",
                        version: meta.version,
                        fromCache: true,
                    };
                } catch {
                    // Manifest missing from cache — fall through to fresh install
                }
            }
        }
    }

    // Detect package manager from lockfile
    const packageManager = await detectPackageManager(basePath);

    // Ensure cache directory exists
    await mkdir(NPM_CACHE_DIR, { recursive: true });

    // Clean up existing cache dir before installing
    try {
        await rm(cachePath, { recursive: true, force: true });
    } catch {
        // Ignore cleanup errors
    }

    // Create the cache directory
    await mkdir(cachePath, { recursive: true });

    try {
        // Initialize package.json in cache dir
        await execFileAsync("npm", ["init", "-y"], { cwd: cachePath });

        // Install the package
        const { command, args } = getInstallCommand(packageManager, source.package);
        try {
            await execFileAsync(command, args, { cwd: cachePath });
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
        const packagePath = path.join(cachePath, "node_modules", source.package);

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

        // Write cache metadata after successful install
        await writeCacheMeta(cachePath, {
            version,
            installedAt: Date.now(),
            package: source.package,
            subpath: source.subpath,
        });

        return {
            localPath: profilePath,
            packageManager,
            version,
            fromCache: false,
        };
    } catch (error) {
        // Clean up cache directory on error
        try {
            await rm(cachePath, { recursive: true, force: true });
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
