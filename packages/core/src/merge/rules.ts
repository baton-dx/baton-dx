import type { Scope } from "@baton-dx/ai-tool-paths";

/**
 * Represents a rule entry — always universal (per-tool targeting uses baton:if).
 * The `agents` field is kept (always `[]`) for backward compatibility
 * with the sync pipeline's placement logic.
 */
export interface RuleEntry {
    name: string; // Rule filename (e.g., "coding-standards", "frontend/react")
    agents: string[]; // Always empty — per-tool targeting uses baton:if directives
    scope: Scope; // Resolved scope for placement
    profileName: string; // Source profile name for file resolution
}
