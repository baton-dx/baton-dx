import { z } from "zod";
import { KEBAB_CASE_REGEX, SEMVER_REGEX } from "./constants.js";

/**
 * Weight schema for profile prioritization during merges.
 * - 0 = default priority
 * - positive values = higher priority (wins conflicts)
 * - -1 = lock (cannot be overridden by any other profile)
 */
export const weightSchema = z.number().int().min(-1).default(0);

/**
 * AI section in source manifest — default AI tools for all profiles in this source.
 *
 * `tools` defines which AI tools this source targets. Individual profiles inherit
 * this list unless they override it with their own `ai.tools`.
 *
 * Use `["*"]` as a wildcard to explicitly target all supported AI tools.
 * Omitting `tools` entirely has the same effect when profiles contain AI content.
 */
const sourceAiSectionSchema = z
    .object({
        tools: z.array(z.string()).optional(),
    })
    .optional();

/**
 * IDE section in source manifest — default IDE platforms for all profiles in this source
 */
const sourceIdeSectionSchema = z
    .object({
        platforms: z.array(z.string()).optional(),
    })
    .optional();

export const sourceManifestSchema = z.object({
    name: z.string().regex(KEBAB_CASE_REGEX, {
        message: "Source name must be kebab-case (e.g., my-source, 3d-tools)",
    }),
    version: z.string().regex(SEMVER_REGEX, {
        message: "Version must be a valid semver string (e.g., 1.0.0)",
    }),
    description: z.string().optional(),
    repository: z.string().optional(),

    // Default AI tools for all profiles in this source.
    // Profiles inherit this list; use ["*"] for all tools.
    // Individual profiles can override with their own ai.tools.
    ai: sourceAiSectionSchema,

    // Optional: Default IDE platforms for all profiles in this source
    ide: sourceIdeSectionSchema,

    metadata: z.record(z.string(), z.string()).optional(),
});

// --- Legacy field detection ---

/**
 * Detect pre-1.0 source manifest fields and return actionable error messages.
 */
export function detectLegacySourceFields(rawManifest: unknown): string[] {
    if (typeof rawManifest !== "object" || rawManifest === null) return [];
    const manifest = rawManifest as Record<string, unknown>;
    const errors: string[] = [];

    if ("profiles" in manifest && manifest.profiles !== undefined) {
        errors.push(
            '"profiles" is no longer supported in baton.source.yaml. ' +
                "Profiles are auto-discovered from the profiles/ directory. " +
                "Remove the field and ensure each profile has a baton.profile.yaml.",
        );
    }

    return errors;
}
