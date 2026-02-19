import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parse, stringify } from "yaml";
import { ManifestValidationError } from "../errors.js";
import { type ProjectPreferences, projectPreferencesSchema } from "./preferences-schema.js";

/**
 * Returns the path to the project preferences file.
 *
 * @param projectRoot - Absolute path to the project root
 * @returns Absolute path to .baton/preferences.yaml
 */
export function getPreferencesPath(projectRoot: string): string {
  return join(projectRoot, ".baton", "preferences.yaml");
}

/**
 * Reads project preferences from .baton/preferences.yaml
 *
 * @param projectRoot - Absolute path to the project root
 * @returns Parsed ProjectPreferences, or null if the file doesn't exist
 * @throws {ManifestValidationError} If the file exists but contains invalid data
 */
export async function readProjectPreferences(
  projectRoot: string,
): Promise<ProjectPreferences | null> {
  const prefsPath = getPreferencesPath(projectRoot);

  try {
    const content = await readFile(prefsPath, "utf-8");
    const parsed = parse(content);
    return projectPreferencesSchema.parse(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw new ManifestValidationError(
      `Invalid project preferences at ${prefsPath}: ${(error as Error).message}`,
      { cause: error as Error },
    );
  }
}

/**
 * Writes project preferences to .baton/preferences.yaml
 *
 * Creates the .baton/ directory if it doesn't exist.
 *
 * @param projectRoot - Absolute path to the project root
 * @param prefs - The preferences to write (will be validated)
 * @throws {ManifestValidationError} If preferences validation fails
 */
export async function writeProjectPreferences(
  projectRoot: string,
  prefs: ProjectPreferences,
): Promise<void> {
  const validated = projectPreferencesSchema.parse(prefs);
  const prefsPath = getPreferencesPath(projectRoot);

  await mkdir(dirname(prefsPath), { recursive: true });
  await writeFile(prefsPath, stringify(validated), "utf-8");
}

/**
 * Deletes the project preferences file.
 *
 * Does not throw if the file doesn't exist.
 *
 * @param projectRoot - Absolute path to the project root
 */
export async function deleteProjectPreferences(projectRoot: string): Promise<void> {
  const prefsPath = getPreferencesPath(projectRoot);
  await rm(prefsPath, { force: true });
}
