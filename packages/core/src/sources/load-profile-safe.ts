import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { profileManifestSchema } from "../schemas/profile-manifest.js";

/**
 * Loads and parses a profile manifest from a given path within a source repository.
 * Returns null if the file doesn't exist (ENOENT). Logs a warning for schema
 * validation errors and other failures so they are visible to the user.
 *
 * @param sourceRoot - Absolute path to the source repository root
 * @param profilePath - Relative path to the profile (e.g., "profiles/frontend")
 * @returns Parsed manifest summary or null
 */
export async function loadProfileManifestSafe(
  sourceRoot: string,
  profilePath: string,
): Promise<{ name: string; version: string; description?: string } | null> {
  const manifestPath = join(sourceRoot, profilePath, "baton.profile.yaml");

  try {
    const content = await readFile(manifestPath, "utf-8");
    const parsed = parseYaml(content);

    const manifest = profileManifestSchema.parse(parsed);

    return {
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
    };
  } catch (error) {
    // File not found — silently return null (profile directory exists but has no manifest)
    if (
      (error as NodeJS.ErrnoException).code === "ENOENT" ||
      (error instanceof Error && error.message.includes("ENOENT"))
    ) {
      return null;
    }

    // Schema validation error — warn with details so the user can fix the manifest
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
      console.warn(`Warning: Invalid profile manifest at ${manifestPath}:\n${issues}`);
      return null;
    }

    // Other errors (YAML parse failure, permission issues, etc.)
    console.warn(
      `Warning: Could not load profile manifest at ${manifestPath}: ${error instanceof Error ? error.message : error}`,
    );
    return null;
  }
}
