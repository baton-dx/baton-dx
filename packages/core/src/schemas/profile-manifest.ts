import { z } from "zod";
import { weightSchema } from "./source-manifest.js";

/**
 * Merge strategy types for file merging
 */
/**
 * Active merge strategies.
 * - `concat`: contributions joined in weight order (default)
 * - `replace`: highest-weight contribution wins entirely
 *
 * Legacy strategies (append, prepend, deep, skip, prompt, directory, import)
 * are accepted for backward compatibility but emit deprecation warnings.
 */
export const mergeStrategySchema = z.enum([
    "concat",
    "replace",
    // Legacy — accepted with deprecation warning
    "deep",
    "append",
    "prepend",
    "skip",
    "prompt",
    "directory",
    "import",
]);

/**
 * Scope for configuration items
 */
export const scopeSchema = z.enum(["project", "global"]);

/**
 * Skill item in profile manifest
 */
export const skillItemSchema = z.object({
    name: z.string(),
    scope: scopeSchema.optional(),
});

/**
 * Rules in profile manifest - can be either an array or an object
 */
const rulesSchema = z.union([
    // Array format: universal rules
    z.array(z.string()),
    // Object format: keys are "universal" or any AI tool key (e.g., "claude-code", "cursor")
    z.record(z.string(), z.array(z.string()).optional()),
]);

/**
 * Agents in profile manifest - can be either an array or an object
 */
const agentsSchema = z.union([
    // Array format: universal agents
    z.array(z.string()),
    // Object format: keys are "universal" or any AI tool key (e.g., "claude-code", "cursor")
    z.record(z.string(), z.array(z.string()).optional()),
]);

/**
 * Memory file configuration item
 *
 * Convention: Use "MEMORY.md" as source for generic memory that will be
 * automatically transformed to target-specific filenames (CLAUDE.md, AGENTS.md, etc.)
 *
 * Or use explicit filenames (CLAUDE.md, AGENTS.md) for tool-specific memory.
 */
const memoryItemSchema = z.object({
    source: z.string(), // e.g., "MEMORY.md", "CLAUDE.md", "AGENTS.md"
    merge: mergeStrategySchema,
    scope: scopeSchema.optional(),
});

/**
 * Memory section in profile manifest - array of memory items
 */
const memorySectionSchema = z.array(memoryItemSchema).optional();

/**
 * Env-var values in MCP server definitions must use ${VAR} or ${VAR:-default} syntax.
 * This allows Baton to transform them per-tool while preventing arbitrary shell injection.
 */
const envVarValueSchema = z.string().regex(
    /^\$\{[A-Z_][A-Z0-9_]*(:-[^}]*)?\}$/,
    // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional literal in error message
    "Env-Werte müssen ${VAR} oder ${VAR:-default} Syntax verwenden (z.B. ${HOME} oder ${PORT:-3000})",
);

/**
 * MCP transport type
 */
export const mcpTransportSchema = z.enum(["stdio", "http", "sse"]);
export type McpTransport = z.infer<typeof mcpTransportSchema>;

/**
 * MCP server definition in profile manifest.
 * Canonical format — adapters transform this to tool-specific format.
 */
export const mcpServerSchema = z.object({
    name: z.string().regex(KEBAB_CASE_REGEX, {
        message: "MCP-Servername muss kebab-case sein (z.B. my-server)",
    }),
    transport: mcpTransportSchema,
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string(), envVarValueSchema).optional(),
    url: z.string().url().optional(),
    headers: z.record(z.string(), z.string()).optional(),
    scope: scopeSchema.optional(),
    /** Optional: restrict this server to specific AI tools (e.g., ["claude-code", "cursor"]) */
    tools: z.array(z.string()).optional(),
});

export type McpServer = z.infer<typeof mcpServerSchema>;

/**
 * AI section in profile manifest.
 *
 * `tools` is optional — when omitted, the profile inherits `ai.tools` from
 * its source manifest. If neither profile nor source declares tools but the
 * profile has AI content (skills, rules, agents, memory, mcp, commands),
 * all AI tools are targeted (implicit wildcard).
 *
 * Use `["*"]` as an explicit wildcard to target all supported AI tools.
 */
const aiSectionSchema = z
    .object({
        tools: z.array(z.string()).optional(), // Optional: inherits from source. Use ["*"] for all tools.
        skills: z.array(skillItemSchema).optional(),
        rules: rulesSchema.optional(),
        agents: agentsSchema.optional(),
        memory: memorySectionSchema.optional(),
        commands: z.array(z.string()).optional(),
        mcp: z.array(mcpServerSchema).optional(),
    })
    .optional();

/**
 * File configuration item with optional target mapping
 *
 * Note: Files are deduplicated by target path (last-wins by weight),
 * not merged. Merge strategies only apply to memory items.
 */
const fileConfigItemSchema = z.object({
    source: z.string(), // e.g., "biome.json", "company/policy.md"
    target: z.string().optional(), // Optional target path. If not specified, uses source as target
});

/**
 * Files section in profile manifest - array of file configurations
 */
const filesSectionSchema = z.array(fileConfigItemSchema).optional();

/**
 * IDE section in profile manifest
 * Keys are IDE platform identifiers (e.g., vscode, jetbrains, zed, fleet)
 * Values are arrays of filenames to sync for that platform
 */
const ideSectionSchema = z.record(z.string(), z.array(z.string())).optional();

/**
 * Profile manifest schema
 */
import { KEBAB_CASE_REGEX, SEMVER_REGEX } from "./constants.js";

export { KEBAB_CASE_REGEX } from "./constants.js";

export const profileManifestSchema = z.object({
    name: z.string().regex(KEBAB_CASE_REGEX, {
        message: "Profile name must be kebab-case (e.g., my-profile, 3d)",
    }),
    version: z.string().regex(SEMVER_REGEX, {
        message: "Version must be a valid semver string (e.g., 1.0.0)",
    }),
    description: z.string().optional(),
    extends: z
        .string()
        .regex(KEBAB_CASE_REGEX, {
            message: "extends must be a kebab-case profile name (e.g., 'base', 'react-base')",
        })
        .optional(),
    weight: weightSchema.optional(),
    scope: scopeSchema.optional(),
    ai: aiSectionSchema,
    files: filesSectionSchema,
    ide: ideSectionSchema,
    variables: z.record(z.string(), z.string()).optional(),
    hooks: z
        .object({
            "post-install": z.string().optional(),
            "post-update": z.string().optional(),
        })
        .optional(),
});

/**
 * Inferred TypeScript type for profile manifest
 */
export type ProfileManifest = z.infer<typeof profileManifestSchema>;

/**
 * Inferred types for nested structures
 */
export type MergeStrategy = z.infer<typeof mergeStrategySchema>;
// Scope type is exported from @baton-dx/ai-tool-paths
export type SkillItem = z.infer<typeof skillItemSchema>;
export type MemoryItem = z.infer<typeof memoryItemSchema>;
