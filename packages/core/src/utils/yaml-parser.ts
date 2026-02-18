import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import type { ZodTypeAny, infer as zInfer } from "zod";
import { FileNotFoundError, ManifestValidationError } from "../errors.js";

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
import type { LockFile } from "../schemas/lockfile.js";
import { lockfileSchema } from "../schemas/lockfile.js";
import type { ProfileManifest } from "../schemas/profile-manifest.js";
import { profileManifestSchema } from "../schemas/profile-manifest.js";
import type { ProjectManifest } from "../schemas/project-manifest.js";
import { projectManifestSchema } from "../schemas/project-manifest.js";

/**
 * Generic helper to load a YAML file, parse it, and validate against a Zod schema
 */
async function loadAndValidateYaml<S extends ZodTypeAny>(
  filePath: string,
  schema: S,
  entityName: string,
): Promise<zInfer<S>> {
  try {
    const content = await readFile(filePath, "utf-8");
    const data = parse(content);

    const result = schema.safeParse(data);
    if (!result.success) {
      const errorMessages = result.error.errors
        .map(
          (err: { path: Array<string | number>; message: string }) =>
            `${err.path.join(".")}: ${err.message}`,
        )
        .join("; ");
      throw new ManifestValidationError(`Invalid ${entityName}: ${errorMessages}`);
    }

    return result.data;
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      throw new FileNotFoundError(`${entityName} not found: ${filePath}`);
    }
    if (error instanceof ManifestValidationError) {
      throw error;
    }
    throw new ManifestValidationError(
      `Failed to parse ${entityName}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Loads and validates a profile manifest from a YAML file
 */
export async function loadProfileManifest(filePath: string): Promise<ProfileManifest> {
  // Pre-validation: detect common schema mistakes before Zod strips unknown keys
  try {
    const content = await readFile(filePath, "utf-8");
    const raw = parse(content);
    if (raw && typeof raw === "object" && "tools" in raw && !raw.ai?.tools) {
      console.warn(
        `Warning: "${filePath}" has top-level "tools:" — this is ignored. Move it under "ai:" section:\n\nai:\n  tools:\n    - ...\n`,
      );
    }
  } catch {
    // Ignore pre-validation errors — loadAndValidateYaml handles them properly
  }
  return loadAndValidateYaml(filePath, profileManifestSchema, "profile manifest");
}

/**
 * Loads and validates a project manifest from a YAML file
 */
export async function loadProjectManifest(filePath: string): Promise<ProjectManifest> {
  return loadAndValidateYaml(filePath, projectManifestSchema, "project manifest");
}

/**
 * Loads and validates a lockfile from a YAML file
 */
export async function loadLockfile(filePath: string): Promise<LockFile> {
  return loadAndValidateYaml(filePath, lockfileSchema, "lockfile");
}
