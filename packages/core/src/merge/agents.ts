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
