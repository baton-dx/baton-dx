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
 * Profile entry in source manifest
 */
export const sourceProfileEntrySchema = z.object({
    name: z.string(),
    path: z.string(), // e.g., "profiles/frontend"
    description: z.string().optional(),
    weight: weightSchema.optional(),
});

/**
 * Source manifest schema
 *
 * The source manifest (baton.source.yaml) defines a source repository that
 * contains one or more profiles in the profiles/ directory.
 *
 * The profiles array is optional - if omitted, profiles will be auto-discovered
 * by scanning the profiles/ directory for baton.profile.yaml files.
 */
/**
 * AI section in source manifest — default AI tools for all profiles in this source
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

    // Optional: Default AI tools for all profiles in this source (can be overridden by profiles)
    ai: sourceAiSectionSchema,

    // Optional: Default IDE platforms for all profiles in this source
    ide: sourceIdeSectionSchema,

    // Optional: Auto-discovered if omitted
    profiles: z.array(sourceProfileEntrySchema).optional(),

    metadata: z.record(z.string(), z.string()).optional(),
});
