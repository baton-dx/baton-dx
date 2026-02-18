import type { ResolvedProfile } from "../inheritance/profile-chain.js";
import type { MergeStrategy } from "../schemas/profile-manifest.js";
import { getProfileWeight, isLockedProfile } from "./weight-sort.js";
import type { WeightConflictWarning } from "./weight-sort.js";

/**
 * A single profile's contribution to a memory file
 */
export interface MemoryContribution {
  profileName: string;
  mergeStrategy: MergeStrategy;
}

/**
 * Represents a memory file entry with all contributing profiles.
 * The most-specific profile (last in chain) determines the final merge strategy.
 */
export interface MemoryEntry {
  filename: string; // e.g., "CLAUDE.md", "AGENTS.md", "GEMINI.md"
  mergeStrategy: MergeStrategy; // from the most-specific (last) profile
  contributions: MemoryContribution[]; // all profiles, in merge order (base first)
}

/**
 * Result of merging memory files with optional conflict warnings
 */
export interface MergeMemoryResult {
  entries: MemoryEntry[];
  warnings: WeightConflictWarning[];
}

/**
 * Merge memory files from multiple profiles in an inheritance chain.
 * Collects ALL contributions per filename so content can be merged at placement time.
 * The merge strategy of the most-specific profile determines how content is combined.
 *
 * Lock behavior: Memory strategy from profiles with weight -1 cannot be overridden.
 * Contributions are always collected, but the governing merge strategy stays locked.
 *
 * @param profiles - Array of resolved profiles in merge order (base first, overrides last)
 * @returns Array of memory file entries with all contributions
 */
export function mergeMemory(profiles: ResolvedProfile[]): MemoryEntry[] {
  return mergeMemoryWithWarnings(profiles).entries;
}

/**
 * Merge memory files with detailed conflict warnings.
 *
 * @param profiles - Array of resolved profiles in merge order (base first, overrides last)
 * @returns Memory entries and any same-weight conflict warnings
 */
export function mergeMemoryWithWarnings(profiles: ResolvedProfile[]): MergeMemoryResult {
  const memoryMap = new Map<string, MemoryEntry>();
  const lockedKeys = new Set<string>();
  const warnings: WeightConflictWarning[] = [];

  // Track which profile set each key's strategy for same-weight conflict detection
  const strategyOwner = new Map<string, { profileName: string; weight: number }>();

  for (const profile of profiles) {
    const memory = profile.manifest.ai?.memory;

    if (!memory || !Array.isArray(memory)) {
      continue;
    }

    const weight = getProfileWeight(profile);
    const locked = isLockedProfile(profile);

    for (const item of memory) {
      const existing = memoryMap.get(item.source);
      const contribution: MemoryContribution = {
        profileName: profile.name,
        mergeStrategy: item.merge,
      };

      if (existing) {
        // Always add contribution (all profiles contribute content)
        existing.contributions.push(contribution);

        // Only update governing strategy if not locked
        if (!lockedKeys.has(item.source)) {
          // Check for same-weight conflict on strategy
          const owner = strategyOwner.get(item.source);
          if (owner && owner.weight === weight && owner.profileName !== profile.name) {
            warnings.push({
              key: item.source,
              category: "memory",
              profileA: owner.profileName,
              profileB: profile.name,
              weight,
            });
          }

          existing.mergeStrategy = item.merge;
          strategyOwner.set(item.source, { profileName: profile.name, weight });

          if (locked) {
            lockedKeys.add(item.source);
          }
        }
      } else {
        memoryMap.set(item.source, {
          filename: item.source,
          mergeStrategy: item.merge,
          contributions: [contribution],
        });
        strategyOwner.set(item.source, { profileName: profile.name, weight });

        if (locked) {
          lockedKeys.add(item.source);
        }
      }
    }
  }

  return {
    entries: Array.from(memoryMap.values()),
    warnings,
  };
}
