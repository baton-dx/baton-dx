import type { Scope } from "@baton-dx/ai-tool-paths";
import type { ResolvedProfile } from "../inheritance/profile-chain.js";
import { resolveScope } from "./scope-resolution.js";
import { getProfileWeight, isLockedProfile } from "./weight-sort.js";
import type { WeightConflictWarning } from "./weight-sort.js";

/**
 * Represents an agent entry that can be tool-specific or universal
 */
export interface AgentEntry {
  name: string; // Agent filename (e.g., "code-reviewer", "test-writer")
  agents: string[]; // Target agent keys (empty array = universal)
  scope: Scope; // Resolved scope for placement
  profileName: string; // Source profile name for file resolution
}

/**
 * Result of merging agents with optional conflict warnings
 */
export interface MergeAgentsResult {
  agents: AgentEntry[];
  warnings: WeightConflictWarning[];
}

/**
 * Merge agents from multiple profiles in an inheritance chain.
 * Agents are merged additively - all agents from all profiles are collected.
 * Name conflicts: more specific profile wins (later in chain overrides earlier).
 *
 * Lock behavior: Agents from profiles with weight -1 cannot be overridden.
 * Same-weight warnings: When two profiles with the same weight define the same agent key,
 * a warning is emitted.
 *
 * @param profiles - Array of resolved profiles in merge order (base first, overrides last)
 * @returns Array of unique agent entries with their target tools
 */
export function mergeAgents(profiles: ResolvedProfile[]): AgentEntry[] {
  return mergeAgentsWithWarnings(profiles).agents;
}

/**
 * Merge agents with detailed conflict warnings.
 *
 * @param profiles - Array of resolved profiles in merge order (base first, overrides last)
 * @returns Agents and any same-weight conflict warnings
 */
export function mergeAgentsWithWarnings(profiles: ResolvedProfile[]): MergeAgentsResult {
  const agentMap = new Map<string, AgentEntry>();
  const lockedKeys = new Set<string>();
  const warnings: WeightConflictWarning[] = [];

  // Track which profile set each key for same-weight conflict detection
  const keyOwner = new Map<string, { profileName: string; weight: number }>();

  for (const profile of profiles) {
    const agents = profile.manifest.ai?.agents;

    if (!agents) {
      continue;
    }

    const weight = getProfileWeight(profile);
    const locked = isLockedProfile(profile);

    if (Array.isArray(agents)) {
      for (const agentName of agents) {
        const key = `universal:${agentName}`;

        if (lockedKeys.has(key)) {
          continue;
        }

        const existing = keyOwner.get(key);
        if (existing && existing.weight === weight && existing.profileName !== profile.name) {
          warnings.push({
            key: agentName,
            category: "agent",
            profileA: existing.profileName,
            profileB: profile.name,
            weight,
          });
        }

        agentMap.set(key, {
          name: agentName,
          agents: [],
          scope: resolveScope(undefined, profile.manifest.scope),
          profileName: profile.name,
        });
        keyOwner.set(key, { profileName: profile.name, weight });

        if (locked) {
          lockedKeys.add(key);
        }
      }
    } else {
      for (const [agentKey, agentNames] of Object.entries(agents)) {
        if (!agentNames) continue;

        for (const agentName of agentNames) {
          const isUniversal = agentKey === "universal";
          const key = `${agentKey}:${agentName}`;

          if (lockedKeys.has(key)) {
            continue;
          }

          const existing = keyOwner.get(key);
          if (existing && existing.weight === weight && existing.profileName !== profile.name) {
            warnings.push({
              key: `${agentKey}:${agentName}`,
              category: "agent",
              profileA: existing.profileName,
              profileB: profile.name,
              weight,
            });
          }

          agentMap.set(key, {
            name: agentName,
            agents: isUniversal ? [] : [agentKey],
            scope: resolveScope(undefined, profile.manifest.scope),
            profileName: profile.name,
          });
          keyOwner.set(key, {
            profileName: profile.name,
            weight,
          });

          if (locked) {
            lockedKeys.add(key);
          }
        }
      }
    }
  }

  return {
    agents: Array.from(agentMap.values()),
    warnings,
  };
}
