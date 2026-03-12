import type { Scope } from "@baton-dx/ai-tool-paths";

/**
 * Represents an agent entry — always universal in v2.
 * The `agents` field is kept (always `[]`) for backward compatibility
 * with the sync pipeline's placement logic.
 */
export interface AgentEntry {
    name: string; // Agent filename (e.g., "code-reviewer", "test-writer")
    agents: string[]; // Always empty in v2 — per-tool targeting uses baton:if directives
    scope: Scope; // Resolved scope for placement
    profileName: string; // Source profile name for file resolution
}

/**
 * Result of merging agents with optional conflict warnings
 */
export interface MergeAgentsResult {
    agents: AgentEntry[];
    warnings: string[];
}

/**
 * Merge/deduplicate agent entries from discovery.
 *
 * In v2, agents come from filesystem discovery (flat arrays of AgentEntry).
 * Per-tool targeting is handled by baton:if directives in frontmatter,
 * not by the manifest schema.
 *
 * Deduplication: last entry wins (entries are expected in weight-sorted order).
 *
 * @param entries - Array of agent entries in merge order (base first, overrides last)
 * @returns Deduplicated array of agent entries
 */
export function mergeAgentEntries(entries: AgentEntry[]): AgentEntry[] {
    const agentMap = new Map<string, AgentEntry>();
    for (const entry of entries) {
        agentMap.set(entry.name, entry);
    }
    return Array.from(agentMap.values());
}
