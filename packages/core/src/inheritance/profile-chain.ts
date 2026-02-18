import { resolve } from "node:path";
import { CircularInheritanceError } from "../errors.js";
import type { ProfileManifest } from "../schemas/profile-manifest.js";
import { cloneGitSource } from "../sources/git-clone.js";
import { parseSource } from "../utils/source-parser.js";
import { loadProfileManifest } from "../utils/yaml-parser.js";

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
}

/**
 * Resolve profile inheritance chain
 * Loads all profiles in the extends chain recursively
 *
 * @param manifest - Root profile manifest
 * @param source - Source URL or path of root profile
 * @param baseDir - Base directory for resolving relative paths
 * @returns Array of resolved profiles in merge order (base first, overrides last)
 */
export async function resolveProfileChain(
  manifest: ProfileManifest,
  source: string,
  baseDir: string,
): Promise<ResolvedProfile[]> {
  const chain: ResolvedProfile[] = [];
  const visited = new Set<string>();

  // Start with the root profile
  await resolveChainRecursive(manifest, source, baseDir, chain, visited, []);

  return chain;
}

/**
 * Recursively resolve profile chain
 *
 * @param manifest - Current profile manifest
 * @param source - Source URL or path
 * @param baseDir - Base directory for resolving relative paths
 * @param chain - Accumulator for resolved profiles
 * @param visited - Set of visited sources (for circular detection)
 * @param path - Current path (for error messages)
 */
async function resolveChainRecursive(
  manifest: ProfileManifest,
  source: string,
  baseDir: string,
  chain: ResolvedProfile[],
  visited: Set<string>,
  path: string[],
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

  // Process extends (parent profiles) first
  if (manifest.extends && manifest.extends.length > 0) {
    for (const extendSource of manifest.extends) {
      try {
        // Load parent profile
        const parentManifest = await loadProfileFromSource(extendSource, baseDir);

        // Recursively resolve parent chain with current visited set
        await resolveChainRecursive(parentManifest, extendSource, baseDir, chain, currentVisited, [
          ...path,
        ]);
      } catch (error) {
        // Re-throw critical errors that should not be swallowed
        if (error instanceof CircularInheritanceError) {
          throw error;
        }
        if (error instanceof Error && error.message.includes("exceeds maximum depth")) {
          throw error;
        }
        // Skip missing parent profiles gracefully (e.g., template-generated extends refs)
      }
    }
  }

  // Add current profile to chain (after parents)
  chain.push({
    manifest,
    source,
    name: manifest.name,
  });

  // Remove from path for sibling processing
  path.pop();
}

/**
 * Load a profile from a source (Git URL or local path)
 *
 * @param source - Source URL or path
 * @param baseDir - Base directory for resolving relative paths
 * @returns Loaded profile manifest
 */
async function loadProfileFromSource(source: string, baseDir: string): Promise<ProfileManifest> {
  const parsed = parseSource(source);

  if (parsed.provider === "local") {
    // Local source: resolve relative to baseDir
    const absolutePath = resolve(baseDir, parsed.path);
    const manifestPath = resolve(absolutePath, "baton.profile.yaml");

    return await loadProfileManifest(manifestPath);
  }

  if (parsed.provider === "file") {
    // File source: resolve path (can be relative or absolute)
    const absolutePath = parsed.path.startsWith("/") ? parsed.path : resolve(baseDir, parsed.path);
    const manifestPath = resolve(absolutePath, "baton.profile.yaml");

    return await loadProfileManifest(manifestPath);
  }

  if (parsed.provider === "npm") {
    // NPM source: not yet implemented
    throw new Error("NPM sources are not yet implemented in inheritance chain");
  }

  // Git source (github, gitlab, git): clone and load
  const subpath = parsed.provider !== "git" ? parsed.subpath : undefined;
  const cloned = await cloneGitSource({
    url: parsed.url,
    ref: parsed.ref,
    subpath,
  });

  const manifestPath = resolve(cloned.localPath, "baton.profile.yaml");
  return await loadProfileManifest(manifestPath);
}
