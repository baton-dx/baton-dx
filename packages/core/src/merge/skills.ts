import type { Scope } from "@baton-dx/ai-tool-paths";

/**
 * Merged skill item with profile attribution.
 * In v2, skills are discovered from the filesystem (ai/skills/<name>/SKILL.md).
 */
export interface MergedSkillItem {
    name: string;
    scope: Scope;
    profileName: string;
}

/**
 * Result of merging skills with optional conflict warnings
 */
export interface MergeSkillsResult {
    skills: MergedSkillItem[];
    warnings: string[];
}

/**
 * Merge/deduplicate skill entries from discovery.
 *
 * Skills with the same name: last one wins (entries are expected in weight-sorted order).
 *
 * @param entries - Array of skill entries in merge order (base first, overrides last)
 * @returns Deduplicated array of skill entries
 */
export function mergeSkillEntries(entries: MergedSkillItem[]): MergedSkillItem[] {
    const skillMap = new Map<string, MergedSkillItem>();
    for (const entry of entries) {
        skillMap.set(entry.name, entry);
    }
    return Array.from(skillMap.values());
}
