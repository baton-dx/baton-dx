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
