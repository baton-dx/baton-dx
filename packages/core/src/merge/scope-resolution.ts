import type { Scope } from "@baton-dx/ai-tool-paths";

/**
 * Resolve the effective scope for a config item.
 *
 * Priority (highest → lowest):
 *   1. Item-level scope (e.g., skill.scope, memory.scope)
 *   2. Profile-level scope (profileManifest.scope)
 *   3. System default: "project"
 */
export function resolveScope(itemScope: Scope | undefined, profileScope: Scope | undefined): Scope {
  return itemScope ?? profileScope ?? "project";
}
