import type { Scope } from "@baton-dx/ai-tool-paths";
import type { ResolvedProfile } from "../inheritance/profile-chain.js";
import { resolveScope } from "./scope-resolution.js";
import type { WeightConflictWarning } from "./weight-sort.js";
import { getProfileWeight, isLockedProfile } from "./weight-sort.js";

/**
 * Represents a rule entry that can be agent-specific or universal
 */
export interface RuleEntry {
  name: string; // Rule filename (e.g., "coding-standards", "frontend/react")
  agents: string[]; // Target agent keys (empty array = universal)
  scope: Scope; // Resolved scope for placement
  profileName: string; // Source profile name for file resolution
}

/**
 * Result of merging rules with optional conflict warnings
 */
export interface MergeRulesResult {
  rules: RuleEntry[];
  warnings: WeightConflictWarning[];
}

/**
 * Merge rules from multiple profiles in an inheritance chain.
 * Rules are merged additively - all rules from all profiles are collected.
 * Name conflicts: more specific profile wins (later in chain overrides earlier).
 *
 * Lock behavior: Rules from profiles with weight -1 cannot be overridden.
 * Same-weight warnings: When two profiles with the same weight define the same rule key,
 * a warning is emitted.
 *
 * @param profiles - Array of resolved profiles in merge order (base first, overrides last)
 * @returns Array of unique rule entries with their target agents
 */
export function mergeRules(profiles: ResolvedProfile[]): RuleEntry[] {
  return mergeRulesWithWarnings(profiles).rules;
}

/**
 * Merge rules with detailed conflict warnings.
 *
 * @param profiles - Array of resolved profiles in merge order (base first, overrides last)
 * @returns Rules and any same-weight conflict warnings
 */
export function mergeRulesWithWarnings(profiles: ResolvedProfile[]): MergeRulesResult {
  const ruleMap = new Map<string, RuleEntry>();
  const lockedKeys = new Set<string>();
  const warnings: WeightConflictWarning[] = [];

  // Track which profile set each key for same-weight conflict detection
  const keyOwner = new Map<string, { profileName: string; weight: number }>();

  for (const profile of profiles) {
    const rules = profile.manifest.ai?.rules;

    if (!rules) {
      continue;
    }

    const weight = getProfileWeight(profile);
    const locked = isLockedProfile(profile);

    if (Array.isArray(rules)) {
      for (const ruleName of rules) {
        const key = `universal:${ruleName}`;

        if (lockedKeys.has(key)) {
          continue;
        }

        const existing = keyOwner.get(key);
        if (existing && existing.weight === weight && existing.profileName !== profile.name) {
          warnings.push({
            key: ruleName,
            category: "rule",
            profileA: existing.profileName,
            profileB: profile.name,
            weight,
          });
        }

        ruleMap.set(key, {
          name: ruleName,
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
      for (const [agentKey, ruleNames] of Object.entries(rules)) {
        if (!ruleNames) continue;

        for (const ruleName of ruleNames) {
          const isUniversal = agentKey === "universal";
          const key = `${agentKey}:${ruleName}`;

          if (lockedKeys.has(key)) {
            continue;
          }

          const existing = keyOwner.get(key);
          if (existing && existing.weight === weight && existing.profileName !== profile.name) {
            warnings.push({
              key: `${agentKey}:${ruleName}`,
              category: "rule",
              profileA: existing.profileName,
              profileB: profile.name,
              weight,
            });
          }

          ruleMap.set(key, {
            name: ruleName,
            agents: isUniversal ? [] : [agentKey],
            scope: resolveScope(undefined, profile.manifest.scope),
            profileName: profile.name,
          });
          keyOwner.set(key, { profileName: profile.name, weight });

          if (locked) {
            lockedKeys.add(key);
          }
        }
      }
    }
  }

  return {
    rules: Array.from(ruleMap.values()),
    warnings,
  };
}
