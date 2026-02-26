import { join, relative, resolve } from "node:path";
import { CircularInheritanceError, FileNotFoundError } from "../errors.js";
import type { ProfileManifest } from "../schemas/profile-manifest.js";
import { cloneGitSource, expandSparseCheckout } from "../sources/git-clone.js";
import { resolveNpmSource } from "../sources/npm-resolver.js";
import { parseSource } from "../utils/source-parser.js";
import { loadProfileManifest } from "../utils/yaml-parser.js";

/**
 * Context for sparse-checkout aware profile chain resolution
 */
export interface CloneContext {
  /** Git repo root (cache directory) */
  cachePath: string;
  /** Whether the repo uses sparse-checkout */
  sparseCheckout: boolean;
}

/**
 * Maximum depth for profile inheritance chain
 */
const MAX_CHAIN_DEPTH = 10;

/**
 * Profile with its source information
 */
export interface ResolvedProfile {
  /** Profile manifest */
  manifest: ProfileManifest;
  /** Source URL or path */
  source: string;
  /** Profile name */
  name: string;
  /** Resolved local directory path (set for local/file/cloned-git sources) */
  localPath?: string;
}

/**
 * Resolve profile inheritance chain
 * Loads all profiles in the extends chain recursively
 *
 * @param manifest - Root profile manifest
 * @param source - Source URL or path of root profile
 * @param baseDir - Base directory for resolving relative paths
 * @param cloneContext - Optional clone context for sparse-checkout expansion
 * @returns Array of resolved profiles in merge order (base first, overrides last)
 */
export async function resolveProfileChain(
  manifest: ProfileManifest,
  source: string,
  baseDir: string,
  cloneContext?: CloneContext,
): Promise<ResolvedProfile[]> {
  const chain: ResolvedProfile[] = [];
  const visited = new Set<string>();

  // Normalize source to absolute path for local/file providers.
  // This ensures cycle detection works correctly when mixing relative and absolute paths,
  // and provides localPath so name-based extends resolution can find sibling profiles.
  const parsed = parseSource(source);
  const isLocal = parsed.provider === "local" || parsed.provider === "file";
  const normalizedSource = isLocal ? resolve(baseDir, parsed.path) : source;
  // For local/file providers: resolve relative path against baseDir (project root convention).
  // For all other providers (github, gitlab, npm, git): callers always pass the cloned
  // profile directory as baseDir (i.e. dirname(manifestPath)), so use it directly.
  const initialLocalPath = isLocal ? resolve(baseDir, parsed.path) : baseDir;

  // Start with the root profile.
  // logicalSource is the original source string (before normalization) — used in the lockfile.
  // normalizedSource is used as the cycle-detection key (absolute path for local sources).
  await resolveChainRecursive(
    manifest,
    normalizedSource,
    source,
    baseDir,
    chain,
    visited,
    [],
    initialLocalPath,
    cloneContext,
  );

  return chain;
}

/**
 * Recursively resolve profile chain
 *
 * @param manifest - Current profile manifest
 * @param source - Cycle-detection key (normalized absolute path for local, logical URL for git)
 * @param logicalSource - Logical source reference written to the lockfile (never a local cache path)
 * @param baseDir - Base directory for resolving relative paths
 * @param chain - Accumulator for resolved profiles
 * @param visited - Set of visited sources (for circular detection)
 * @param path - Current path (for error messages)
 * @param localPath - Resolved local directory path for this profile
 * @param cloneContext - Optional clone context for sparse-checkout expansion
 */
async function resolveChainRecursive(
  manifest: ProfileManifest,
  source: string,
  logicalSource: string,
  baseDir: string,
  chain: ResolvedProfile[],
  visited: Set<string>,
  path: string[],
  localPath?: string,
  cloneContext?: CloneContext,
): Promise<void> {
  // Check for maximum depth
  if (path.length >= MAX_CHAIN_DEPTH) {
    throw new Error(
      `Profile inheritance chain exceeds maximum depth of ${MAX_CHAIN_DEPTH}. Chain: ${path.join(" -> ")} -> ${manifest.name}`,
    );
  }

  // Check for circular inheritance in the current path
  if (visited.has(source)) {
    const cycle = [...path, manifest.name].join(" -> ");
    throw new CircularInheritanceError(`Circular profile inheritance detected: ${cycle}`);
  }

  // Create a new visited set for this subtree (allows diamond inheritance)
  const currentVisited = new Set(visited);
  currentVisited.add(source);
  path.push(manifest.name);

  // Process extends (single parent profile)
  if (manifest.extends) {
    const extendSource = resolveExtendsToPath(manifest.extends, localPath);
    const extendLogicalSource = resolveExtendsLogicalSource(manifest.extends, logicalSource);
    try {
      // Load parent profile
      const { manifest: parentManifest, localPath: parentLocalPath } = await loadProfileFromSource(
        extendSource,
        baseDir,
        cloneContext,
      );

      // Recursively resolve parent chain with current visited set
      await resolveChainRecursive(
        parentManifest,
        extendSource,
        extendLogicalSource,
        baseDir,
        chain,
        currentVisited,
        [...path],
        parentLocalPath,
        cloneContext,
      );
    } catch (error) {
      // Re-throw critical errors that should not be swallowed
      if (error instanceof CircularInheritanceError) {
        throw error;
      }
      if (error instanceof Error && error.message.includes("exceeds maximum depth")) {
        throw error;
      }
      // Re-throw all other errors with enhanced context
      const cause = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to resolve extends '${manifest.extends}' from profile '${manifest.name}': ${cause}`,
      );
    }
  }

  // Add current profile to chain (after parents).
  // Use logicalSource (not the cycle-detection key) so the lockfile stores a portable reference.
  chain.push({
    manifest,
    source: logicalSource,
    name: manifest.name,
    localPath,
  });

  // Remove from path for sibling processing
  path.pop();
}

/**
 * Resolves an extends value to a path for loadProfileFromSource.
 *
 * If the value is a plain profile name (kebab-case, no slashes or colons),
 * it resolves as a sibling profile: ../name relative to the current profile's localPath.
 *
 * If localPath is not available (unusual edge case), returns the name as-is
 * (which would fail to resolve and surface an error to the user).
 */
function resolveExtendsToPath(extendsValue: string, localPath?: string): string {
  // Plain profile name — resolve as sibling
  if (/^[a-z0-9][a-z0-9-]*$/.test(extendsValue) && localPath) {
    return join(localPath, "..", extendsValue);
  }
  // Already a path or URL — return as-is (legacy support, prevented by schema)
  return extendsValue;
}

/**
 * Derives the logical lockfile source for a sibling profile from the parent's logical source.
 *
 * Replaces the last path segment of the parent's logical source with the sibling name.
 * This keeps the lockfile free of user-specific local cache paths when a remote profile
 * uses `extends` to reference a sibling profile.
 *
 * Examples:
 *   "github:org/repo/profiles/maintainer" + "base" → "github:org/repo/profiles/base"
 *   "./profiles/advanced" + "base"                 → "./profiles/base"
 */
function resolveExtendsLogicalSource(siblingName: string, parentLogicalSource: string): string {
  const lastSlash = parentLogicalSource.lastIndexOf("/");
  if (lastSlash === -1) {
    return siblingName;
  }
  return `${parentLogicalSource.slice(0, lastSlash)}/${siblingName}`;
}

/**
 * Load a profile from a source (Git URL or local path)
 *
 * When operating inside a sparse-checkout repo and the profile is not found,
 * expands the sparse-checkout to include the profile path and retries.
 *
 * @param source - Source URL or path
 * @param baseDir - Base directory for resolving relative paths
 * @param cloneContext - Optional clone context for sparse-checkout expansion
 * @returns Loaded profile manifest and resolved local directory path
 */
async function loadProfileFromSource(
  source: string,
  baseDir: string,
  cloneContext?: CloneContext,
): Promise<{ manifest: ProfileManifest; localPath: string }> {
  const parsed = parseSource(source);

  if (parsed.provider === "local") {
    // Local source: resolve relative to baseDir
    const absolutePath = resolve(baseDir, parsed.path);
    const manifestPath = resolve(absolutePath, "baton.profile.yaml");

    try {
      return { manifest: await loadProfileManifest(manifestPath), localPath: absolutePath };
    } catch (error) {
      // If sparse-checkout is active and file not found, expand and retry
      if (error instanceof FileNotFoundError && cloneContext?.sparseCheckout) {
        const relativePath = relative(cloneContext.cachePath, absolutePath);
        await expandSparseCheckout(cloneContext.cachePath, [relativePath]);
        return { manifest: await loadProfileManifest(manifestPath), localPath: absolutePath };
      }
      throw error;
    }
  }

  if (parsed.provider === "file") {
    // File source: resolve path (can be relative or absolute)
    const absolutePath = parsed.path.startsWith("/") ? parsed.path : resolve(baseDir, parsed.path);
    const manifestPath = resolve(absolutePath, "baton.profile.yaml");

    try {
      return { manifest: await loadProfileManifest(manifestPath), localPath: absolutePath };
    } catch (error) {
      // If sparse-checkout is active and file not found, expand and retry
      if (error instanceof FileNotFoundError && cloneContext?.sparseCheckout) {
        const relativePath = relative(cloneContext.cachePath, absolutePath);
        await expandSparseCheckout(cloneContext.cachePath, [relativePath]);
        return { manifest: await loadProfileManifest(manifestPath), localPath: absolutePath };
      }
      throw error;
    }
  }

  if (parsed.provider === "npm") {
    const resolved = await resolveNpmSource({ source: parsed });
    const manifestPath = resolve(resolved.localPath, "baton.profile.yaml");
    return { manifest: await loadProfileManifest(manifestPath), localPath: resolved.localPath };
  }

  // Git source (github, gitlab, git): clone and load
  const subpath = parsed.provider !== "git" ? parsed.subpath : undefined;
  const cloned = await cloneGitSource({
    url: parsed.url,
    ref: parsed.ref,
    subpath,
  });

  const manifestPath = resolve(cloned.localPath, "baton.profile.yaml");
  return { manifest: await loadProfileManifest(manifestPath), localPath: cloned.localPath };
}
