import type { ResolvedProfile } from "../inheritance/profile-chain.js";

/** Weight value that marks a profile as locked (non-overridable) */
export const WEIGHT_LOCK = -1;

/**
 * Get the effective weight for a resolved profile.
 * Weight defaults to 0 if not set.
 */
export function getProfileWeight(profile: ResolvedProfile): number {
    return profile.manifest.weight ?? 0;
}

/**
 * Check if a profile is locked (weight === -1).
 * Locked profiles' entries cannot be overridden by any other profile.
 */
export function isLockedProfile(profile: ResolvedProfile): boolean {
    return getProfileWeight(profile) === WEIGHT_LOCK;
}

/**
 * Sort profiles by weight for merge ordering.
 *
 * Profiles are sorted ascending by weight so that higher-weight profiles
 * appear later in the array. Since merge functions use "last-wins" semantics,
 * higher-weight profiles will take precedence in conflict resolution.
 *
 * The sort is stable: profiles with the same weight retain their original
 * order (declaration order in baton.yaml / inheritance chain order).
 *
 * @param profiles - Array of resolved profiles (already chain-resolved)
 * @returns New array sorted by weight (ascending)
 */
export function sortProfilesByWeight(profiles: ResolvedProfile[]): ResolvedProfile[] {
    return [...profiles].sort((a, b) => {
        const weightA = getProfileWeight(a);
        const weightB = getProfileWeight(b);
        return weightA - weightB;
    });
}

/**
 * Represents a merge conflict warning when two profiles with the same weight
 * define conflicting values for the same key.
 */
export interface WeightConflictWarning {
    key: string;
    category: "skill" | "rule" | "memory" | "command" | "file" | "ide" | "agent" | "mcp";
    profileA: string;
    profileB: string;
    weight: number;
}
