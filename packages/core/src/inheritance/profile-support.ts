import type { z } from "zod";
import { getAllAIToolAdapters } from "../adapters/registry.js";
import type { ProfileManifest } from "../schemas/profile-manifest.js";
import type { sourceManifestSchema } from "../schemas/source-manifest.js";

/**
 * Inferred type for source manifest
 */
export type SourceManifest = z.infer<typeof sourceManifestSchema>;

/**
 * Resolved profile support — the effective AI tools and IDE platforms
 * after applying inheritance from source to profile.
 */
export interface ResolvedProfileSupport {
    /** Resolved AI tools (from profile if defined, otherwise from source) */
    aiTools: string[];
    /** Resolved IDE platforms (from profile if defined, otherwise from source) */
    idePlatforms: string[];
}

/**
 * Resolve the effective AI tools and IDE platforms for a profile,
 * applying inheritance from the source manifest.
 *
 * AI tools resolution (in order):
 *   1. profile `ai.tools` — explicit list or `["*"]` wildcard
 *   2. source `ai.tools`  — fallback, explicit list or `["*"]` wildcard
 *   3. implicit wildcard   — all tools, when profile has AI content but no tools declared
 *   4. empty array         — no AI content anywhere
 *
 * IDE platforms resolution:
 * - If the profile defines an `ide` section (keys = platform names), use those keys
 * - Otherwise, fall back to `sourceManifest.ide.platforms`
 *
 * Profile-level tools/IDEs can be a subset of source-level declarations.
 * `["*"]` in either manifest expands to all registered AI tool keys.
 *
 * @param profileManifest - The profile's manifest
 * @param sourceManifest - The source's manifest (parent defaults)
 * @returns Resolved support with effective tools and platforms
 */
export function resolveProfileSupport(
    profileManifest: ProfileManifest,
    sourceManifest: SourceManifest,
): ResolvedProfileSupport {
    // AI Tools: profile overrides source if defined
    const aiTools = resolveAiTools(profileManifest, sourceManifest);

    // IDE Platforms: profile overrides source if defined
    const idePlatforms = resolveIdePlatforms(profileManifest, sourceManifest);

    return { aiTools, idePlatforms };
}

/**
 * Resolve AI tools: prefer profile's ai.tools, fall back to source's ai.tools.
 *
 * Both profile and source support `["*"]` as an explicit wildcard that expands
 * to all registered AI tool keys. Omitting `ai.tools` entirely is an implicit
 * wildcard when the profile has AI content (skills, rules, agents, memory, mcp,
 * or commands). This prevents profiles from being silently filtered out of the
 * intersection just because the author omitted the optional `ai.tools` field.
 *
 * Resolution order:
 *   1. profile ai.tools (explicit list or `["*"]`)
 *   2. source ai.tools  (fallback, explicit list or `["*"]`)
 *   3. implicit wildcard (all tools) — when profile has AI content
 *   4. empty array       — no AI content anywhere
 */
function resolveAiTools(
    profileManifest: ProfileManifest,
    sourceManifest: SourceManifest,
): string[] {
    // If profile explicitly defines ai.tools (even empty array), use it
    if (profileManifest.ai?.tools !== undefined) {
        return expandWildcard(profileManifest.ai.tools);
    }

    // Fall back to source's ai.tools
    if (sourceManifest.ai?.tools !== undefined) {
        return expandWildcard(sourceManifest.ai.tools);
    }

    // If profile has AI content but no explicit tools list, support all tools
    if (hasAiContent(profileManifest)) {
        return allToolKeys();
    }

    return [];
}

/**
 * Expand `["*"]` to all registered AI tool keys, pass other lists through unchanged.
 */
function expandWildcard(tools: string[]): string[] {
    if (tools.length === 1 && tools[0] === "*") {
        return allToolKeys();
    }
    return tools;
}

/**
 * All registered AI tool keys from the adapter registry.
 */
function allToolKeys(): string[] {
    return getAllAIToolAdapters().map((a) => a.key);
}

/**
 * Check whether the profile manifest has an AI section defined.
 * Content is auto-discovered from the filesystem, so the presence of
 * an `ai` section (even if empty) indicates the profile targets AI tools.
 */
function hasAiContent(profileManifest: ProfileManifest): boolean {
    return profileManifest.ai !== undefined;
}

/**
 * Resolve IDE platforms from source manifest.
 * Profiles no longer declare an `ide` section — IDE platforms
 * are configured only at the source level.
 */
function resolveIdePlatforms(
    _profileManifest: ProfileManifest,
    sourceManifest: SourceManifest,
): string[] {
    if (sourceManifest.ide?.platforms !== undefined) {
        return sourceManifest.ide.platforms;
    }

    return [];
}
