import type { Scope } from "@baton-dx/ai-tool-paths";

/**
 * Represents a rule entry — always universal in v2.
 * The `agents` field is kept (always `[]`) for backward compatibility
 * with the sync pipeline's placement logic.
 */
export interface RuleEntry {
    name: string; // Rule filename (e.g., "coding-standards", "frontend/react")
    agents: string[]; // Always empty in v2 — per-tool targeting uses baton:if directives
    scope: Scope; // Resolved scope for placement
    profileName: string; // Source profile name for file resolution
}

/**
 * Result of merging rules with optional conflict warnings
 */
export interface MergeRulesResult {
    rules: RuleEntry[];
    warnings: string[];
}

/**
 * Merge/deduplicate rule entries from discovery.
 *
 * In v2, rules come from filesystem discovery (flat arrays of RuleEntry).
 * Per-tool targeting is handled by baton:if directives in frontmatter,
 * not by the manifest schema.
 *
 * Deduplication: last entry wins (entries are expected in weight-sorted order).
 *
 * @param entries - Array of rule entries in merge order (base first, overrides last)
 * @returns Deduplicated array of rule entries
 */
export function mergeRuleEntries(entries: RuleEntry[]): RuleEntry[] {
    const ruleMap = new Map<string, RuleEntry>();
    for (const entry of entries) {
        ruleMap.set(entry.name, entry);
    }
    return Array.from(ruleMap.values());
}
