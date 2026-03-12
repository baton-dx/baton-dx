import type { Scope } from "@baton-dx/ai-tool-paths";
import type { MergeStrategy } from "../schemas/profile-manifest.js";

/**
 * A single profile's contribution to a memory file
 */
export interface MemoryContribution {
    profileName: string;
    mergeStrategy: MergeStrategy;
}

/**
 * Represents a memory file entry with all contributing profiles.
 * In v2, there is only one MEMORY.md per profile (discovered from ai/memory/).
 * Multi-profile merging still uses contributions for inheritance chains.
 */
export interface MemoryEntry {
    filename: string; // Always "MEMORY.md" in v2
    mergeStrategy: MergeStrategy; // from the most-specific (last) profile
    scope: Scope; // Resolved scope for placement
    contributions: MemoryContribution[]; // all profiles, in merge order (base first)
}

/**
 * Result of merging memory files
 */
export interface MergeMemoryResult {
    entries: MemoryEntry[];
    warnings: string[];
}
