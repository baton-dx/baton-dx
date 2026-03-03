import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { sourceManifestSchema } from "../schemas/source-manifest.js";
import { loadProfileManifestSafe as loadProfileManifest } from "./load-profile-safe.js";

/**
 * Information about a discovered profile within a source repository
 */
export interface SourceProfileInfo {
  /**
   * Profile name (from manifest)
   */
  name: string;

  /**
   * Relative path to the profile from the source root
   * e.g., "profiles/frontend"
   */
  path: string;

  /**
   * Profile version from manifest
   */
  version: string;

  /**
   * Profile description from manifest (optional)
   */
  description?: string;

  /**
   * Parent profile name this profile extends (optional)
   */
  extends?: string;

  /**
   * Merge weight for this profile (optional, defaults to 0)
   */
  weight?: number;
}

/**
 * Finds and loads the source manifest (baton.source.yaml)
 *
 * @param sourceRoot - Absolute path to the source repository root
 * @returns Parsed source manifest
 * @throws Error if manifest doesn't exist or is invalid
 */
export async function findSourceManifest(sourceRoot: string) {
  const manifestPath = join(sourceRoot, "baton.source.yaml");

  try {
    const content = await readFile(manifestPath, "utf-8");
    const parsed = parseYaml(content);

    // Validate with Zod schema
    const manifest = sourceManifestSchema.parse(parsed);

    return manifest;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `Source manifest not found at ${manifestPath}. This directory is not a Baton source repository.`,
      );
    }
    throw new Error(`Invalid source manifest at ${manifestPath}: ${error}`);
  }
}

/**
 * Checks if a directory contains a source manifest (baton.source.yaml)
 *
 * @param sourceRoot - Absolute path to the directory to check
 * @returns true if baton.source.yaml exists, false otherwise
 */
export async function isSourceRepository(sourceRoot: string): Promise<boolean> {
  const manifestPath = join(sourceRoot, "baton.source.yaml");
  try {
    await access(manifestPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Discovers all profiles in a source repository by scanning the profiles/ directory
 *
 * This function:
 * 1. Scans the profiles/ directory (one level deep)
 * 2. Looks for baton.profile.yaml in each subdirectory
 * 3. Loads manifest metadata (name, version, description) for each profile
 *
 * @param sourceRoot - Absolute path to the source repository root
 * @returns Array of SourceProfileInfo objects for all discovered profiles
 * @throws Error if manifest files are invalid or cannot be read
 */
export async function discoverProfilesInSourceRepo(
  sourceRoot: string,
): Promise<SourceProfileInfo[]> {
  const profiles: SourceProfileInfo[] = [];
  const profilesDir = join(sourceRoot, "profiles");

  try {
    const entries = await readdir(profilesDir, { withFileTypes: true });

    for (const entry of entries) {
      // Only check directories (skip files)
      if (!entry.isDirectory()) {
        continue;
      }

      // Skip hidden directories and common non-profile directories
      if (entry.name.startsWith(".") || entry.name === "node_modules") {
        continue;
      }

      const profilePath = join("profiles", entry.name);
      const manifest = await loadProfileManifest(sourceRoot, profilePath);

      if (manifest) {
        profiles.push({
          name: manifest.name,
          path: profilePath,
          version: manifest.version,
          description: manifest.description,
          extends: manifest.extends,
          weight: manifest.weight,
        });
      }
    }
  } catch (error) {
    // If profiles/ directory doesn't exist or cannot be read, return empty array
    // This allows source repos without profiles (e.g., documentation-only repos)
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  return profiles;
}
