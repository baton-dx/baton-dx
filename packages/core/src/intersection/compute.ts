import type { ResolvedProfileSupport } from "../inheritance/profile-support.js";

/**
 * Developer's configured tools — from ~/.baton/config.yaml
 */
export interface DeveloperTools {
  /** AI tool keys the developer has installed (e.g., ["claude-code", "cursor"]) */
  aiTools: string[];
  /** IDE platform keys the developer has installed (e.g., ["vscode", "jetbrains"]) */
  idePlatforms: string[];
}

/**
 * Result of a single dimension's intersection computation (AI tools or IDE platforms).
 */
export interface DimensionIntersection {
  /** Tools/platforms in both developer config AND profile support (will be synced) */
  synced: string[];
  /** Tools/platforms the developer has but the profile does NOT support */
  unsupported: string[];
  /** Tools/platforms the profile supports but the developer does NOT have */
  unavailable: string[];
}

/**
 * Full intersection result across both dimensions.
 */
export interface IntersectionResult {
  /** AI tools intersection */
  aiTools: DimensionIntersection;
  /** IDE platforms intersection */
  idePlatforms: DimensionIntersection;
}

/**
 * Compute the intersection between a developer's configured tools and a profile's declared support.
 *
 * For each dimension (AI tools, IDE platforms), computes:
 * - synced: items present in BOTH sets (developer ∩ profile)
 * - unsupported: items the developer has but the profile doesn't support (developer \ profile)
 * - unavailable: items the profile supports but the developer doesn't have (profile \ developer)
 *
 * @param developerTools - The developer's configured tools from global config
 * @param profileSupport - The resolved profile support (after source → profile inheritance)
 * @returns Intersection result for both AI tools and IDE platforms
 */
export function computeIntersection(
  developerTools: DeveloperTools,
  profileSupport: ResolvedProfileSupport,
): IntersectionResult {
  return {
    aiTools: computeDimensionIntersection(developerTools.aiTools, profileSupport.aiTools),
    idePlatforms: computeDimensionIntersection(
      developerTools.idePlatforms,
      profileSupport.idePlatforms,
    ),
  };
}

/**
 * Compute the intersection for a single dimension (AI tools or IDE platforms).
 *
 * Uses Set operations for efficient lookup:
 * - synced = A ∩ B
 * - unsupported = A \ B
 * - unavailable = B \ A
 */
function computeDimensionIntersection(
  developerItems: string[],
  profileItems: string[],
): DimensionIntersection {
  const devSet = new Set(developerItems);
  const profileSet = new Set(profileItems);

  const synced: string[] = [];
  const unsupported: string[] = [];
  const unavailable: string[] = [];

  // Iterate developer items: classify as synced or unsupported
  for (const item of developerItems) {
    if (profileSet.has(item)) {
      synced.push(item);
    } else {
      unsupported.push(item);
    }
  }

  // Iterate profile items: find unavailable (profile has, developer doesn't)
  for (const item of profileItems) {
    if (!devSet.has(item)) {
      unavailable.push(item);
    }
  }

  return { synced, unsupported, unavailable };
}
