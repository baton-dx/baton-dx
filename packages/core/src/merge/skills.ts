import type { ResolvedProfile } from "../inheritance/profile-chain.js";
import type { SkillItem } from "../schemas/profile-manifest.js";
import { getProfileWeight, isLockedProfile } from "./weight-sort.js";
import type { WeightConflictWarning } from "./weight-sort.js";

/**
 * Merged skill item with profile attribution
 */
export interface MergedSkillItem extends SkillItem {
  profileName: string;
}

/**
 * Result of merging skills with optional conflict warnings
 */
export interface MergeSkillsResult {
  skills: MergedSkillItem[];
  warnings: WeightConflictWarning[];
}

/**
 * Merge skills from multiple profiles in an inheritance chain.
 * Skills with the same name in a more specific profile replace the entire skill directory.
 *
 * Lock behavior: Skills from profiles with weight -1 cannot be overridden.
 * Same-weight warnings: When two profiles with the same weight define the same skill,
 * a warning is emitted (the last one still wins per stable sort order).
 *
 * @param profiles - Array of resolved profiles in merge order (base first, overrides last)
 * @returns Deduplicated array of skills with most specific versions and profile attribution
 */
export function mergeSkills(profiles: ResolvedProfile[]): MergedSkillItem[] {
  return mergeSkillsWithWarnings(profiles).skills;
}

/**
 * Merge skills with detailed conflict warnings.
 *
 * @param profiles - Array of resolved profiles in merge order (base first, overrides last)
 * @returns Skills and any same-weight conflict warnings
 */
export function mergeSkillsWithWarnings(profiles: ResolvedProfile[]): MergeSkillsResult {
  const skillMap = new Map<string, MergedSkillItem>();
  const lockedKeys = new Set<string>();
  const warnings: WeightConflictWarning[] = [];

  // Track which profile set each key for same-weight conflict detection
  const keyOwner = new Map<string, { profileName: string; weight: number }>();

  for (const profile of profiles) {
    const skills = profile.manifest.ai?.skills || [];
    const weight = getProfileWeight(profile);
    const locked = isLockedProfile(profile);

    for (const skill of skills) {
      // Skip if this key is locked by a previous profile
      if (lockedKeys.has(skill.name)) {
        continue;
      }

      // Check for same-weight conflict
      const existing = keyOwner.get(skill.name);
      if (existing && existing.weight === weight && existing.profileName !== profile.name) {
        warnings.push({
          key: skill.name,
          category: "skill",
          profileA: existing.profileName,
          profileB: profile.name,
          weight,
        });
      }

      skillMap.set(skill.name, { ...skill, profileName: profile.name });
      keyOwner.set(skill.name, { profileName: profile.name, weight });

      if (locked) {
        lockedKeys.add(skill.name);
      }
    }
  }

  return {
    skills: Array.from(skillMap.values()),
    warnings,
  };
}
