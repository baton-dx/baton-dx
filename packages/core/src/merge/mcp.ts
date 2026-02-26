import type { Scope } from "@baton-dx/ai-tool-paths";
import type { ResolvedProfile } from "../inheritance/profile-chain.js";
import type { McpServer } from "../schemas/profile-manifest.js";
import { resolveScope } from "./scope-resolution.js";
import type { WeightConflictWarning } from "./weight-sort.js";
import { getProfileWeight, isLockedProfile } from "./weight-sort.js";

/**
 * MCP server with resolved scope and profile attribution
 */
export interface MergedMcpServer extends McpServer {
  scope: Scope; // Override to non-optional — always resolved by merge
  profileName: string;
}

/**
 * Result of merging MCP servers with optional conflict warnings
 */
export interface MergeMcpResult {
  servers: MergedMcpServer[];
  warnings: WeightConflictWarning[];
}

/**
 * Merge MCP servers from multiple profiles.
 * Servers with the same name in a more specific profile replace the earlier definition.
 *
 * Lock behavior: Servers from profiles with weight -1 cannot be overridden.
 * Same-weight warnings: When two profiles with the same weight define the same server name,
 * a warning is emitted (the last one still wins per stable sort order).
 *
 * @param profiles - Array of resolved profiles in merge order (base first, overrides last)
 * @returns Deduplicated map of MCP servers with most specific versions and profile attribution
 */
export function mergeMcp(profiles: ResolvedProfile[]): MergedMcpServer[] {
  return mergeMcpWithWarnings(profiles).servers;
}

/**
 * Merge MCP servers with detailed conflict warnings.
 *
 * @param profiles - Array of resolved profiles in merge order (base first, overrides last)
 * @returns Servers and any same-weight conflict warnings
 */
export function mergeMcpWithWarnings(profiles: ResolvedProfile[]): MergeMcpResult {
  const serverMap = new Map<string, MergedMcpServer>();
  const lockedKeys = new Set<string>();
  const warnings: WeightConflictWarning[] = [];

  // Track which profile set each key for same-weight conflict detection
  const keyOwner = new Map<string, { profileName: string; weight: number }>();

  for (const profile of profiles) {
    const servers = profile.manifest.ai?.mcp || [];
    const weight = getProfileWeight(profile);
    const locked = isLockedProfile(profile);

    for (const server of servers) {
      // Skip if this key is locked by a previous profile
      if (lockedKeys.has(server.name)) {
        continue;
      }

      // Check for same-weight conflict
      const existing = keyOwner.get(server.name);
      if (existing && existing.weight === weight && existing.profileName !== profile.name) {
        warnings.push({
          key: server.name,
          category: "mcp",
          profileA: existing.profileName,
          profileB: profile.name,
          weight,
        });
      }

      serverMap.set(server.name, {
        ...server,
        scope: resolveScope(server.scope, profile.manifest.scope),
        profileName: profile.name,
      });
      keyOwner.set(server.name, { profileName: profile.name, weight });

      if (locked) {
        lockedKeys.add(server.name);
      }
    }
  }

  return {
    servers: Array.from(serverMap.values()),
    warnings,
  };
}
