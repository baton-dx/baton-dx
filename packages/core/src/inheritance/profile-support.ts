import type { z } from "zod";
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
 * Inheritance rules:
 * - If the profile defines ai.tools, use them (even if empty array)
 * - Otherwise, fall back to sourceManifest.ai.tools
 * - If the profile defines an ide section (keys = platform names), use those keys
 * - Otherwise, fall back to sourceManifest.ide.platforms
 *
 * Profile-level tools/IDEs can be a subset of source-level declarations.
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
 * Resolve AI tools: prefer profile's ai.tools, fall back to source's ai.tools
 */
function resolveAiTools(
  profileManifest: ProfileManifest,
  sourceManifest: SourceManifest,
): string[] {
  // If profile explicitly defines ai.tools (even empty array), use it
  if (profileManifest.ai?.tools !== undefined) {
    return profileManifest.ai.tools;
  }

  // Fall back to source's ai.tools
  if (sourceManifest.ai?.tools !== undefined) {
    return sourceManifest.ai.tools;
  }

  return [];
}

/**
 * Resolve IDE platforms: prefer profile's ide keys, fall back to source's ide.platforms
 *
 * Note: Profile IDE section is Record<string, string[]> where keys are platform names.
 * Source IDE section is { platforms: string[] }. These are structurally different,
 * but both express "which platforms are supported".
 */
function resolveIdePlatforms(
  profileManifest: ProfileManifest,
  sourceManifest: SourceManifest,
): string[] {
  // If profile has an ide section, extract platform keys
  if (profileManifest.ide !== undefined) {
    return Object.keys(profileManifest.ide);
  }

  // Fall back to source's ide.platforms
  if (sourceManifest.ide?.platforms !== undefined) {
    return sourceManifest.ide.platforms;
  }

  return [];
}
