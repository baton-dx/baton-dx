import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { profileManifestSchema } from "../schemas/profile-manifest.js";

/**
 * Loads and parses a profile manifest from a given path within a source repository.
 * Returns null if the file doesn't exist or is invalid (non-throwing variant).
 *
 * @param sourceRoot - Absolute path to the source repository root
 * @param profilePath - Relative path to the profile (e.g., "profiles/frontend")
 * @returns Parsed manifest summary or null
 */
export async function loadProfileManifestSafe(
  sourceRoot: string,
  profilePath: string,
): Promise<{ name: string; version: string; description?: string } | null> {
  try {
    const manifestPath = join(sourceRoot, profilePath, "baton.profile.yaml");
    const content = await readFile(manifestPath, "utf-8");
    const parsed = parseYaml(content);

    const manifest = profileManifestSchema.parse(parsed);

    return {
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
    };
  } catch {
    return null;
  }
}
