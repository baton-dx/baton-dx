import { z } from "zod";
import { KEBAB_CASE_REGEX, SEMVER_REGEX } from "./constants.js";
import { weightSchema } from "./source-manifest.js";

/**
 * Merge strategy types for content merging.
 *
 * v2 only supports "concat" (join with \n\n, default) and "replace" (last wins).
 */
export const mergeStrategySchema = z.enum(["concat", "replace"]);

/**
 * Scope for configuration items
 */
export const scopeSchema = z.enum(["project", "global"]);

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
 * AI section in profile manifest (v2).
 *
 * Content (rules, agents, skills, memory, commands) is auto-discovered from
 * the filesystem — no longer declared in the manifest.
 *
 * `tools` is optional — when omitted, the profile inherits `ai.tools` from
 * its source manifest. Use `["*"]` as an explicit wildcard to target all
 * supported AI tools.
 */
const aiSectionSchema = z
    .object({
        tools: z.array(z.string()).optional(),
    })
    .optional();

/**
 * Profile manifest schema (v2).
 *
 * Content declarations (ai.rules, ai.agents, ai.skills, ai.memory, ai.commands,
 * ai.mcp, files, ide) have been removed. Content is auto-discovered from
 * the filesystem via convention-over-configuration.
 */
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

// --- v1 field detection ---

/** Fields that were valid in v1 manifests but removed in v2. */
const V1_AI_FIELDS = ["rules", "agents", "skills", "memory", "commands", "mcp"] as const;
const V1_TOP_LEVEL_FIELDS = ["files", "ide"] as const;

function hasField(obj: Record<string, unknown>, field: string): boolean {
    return field in obj && obj[field] !== undefined;
}

function v1TopLevelError(field: string): string {
    const what = field === "files" ? "files" : "IDE configs";
    return (
        `"${field}" is no longer supported in baton.profile.yaml v2. ` +
        `Place ${what} directly in the profile filesystem. ` +
        `See migration guide: docs/04-creating-profiles.md`
    );
}

function v1AiFieldError(field: string): string {
    const hint = field === "mcp" ? "MCP servers" : `${field} files`;
    return (
        `"ai.${field}" is no longer supported in baton.profile.yaml v2. ` +
        `Place ${hint} directly in ai/${field}/ instead. ` +
        `See migration guide: docs/04-creating-profiles.md`
    );
}

/**
 * Detect v1 manifest fields and return actionable error messages.
 *
 * @param rawManifest - The raw (unparsed) manifest object
 * @returns Array of error messages for any v1 fields found (empty if none)
 */
export function detectV1Fields(rawManifest: unknown): string[] {
    if (typeof rawManifest !== "object" || rawManifest === null) return [];

    const manifest = rawManifest as Record<string, unknown>;
    const errors: string[] = [];

    for (const field of V1_TOP_LEVEL_FIELDS) {
        if (hasField(manifest, field)) errors.push(v1TopLevelError(field));
    }

    if (typeof manifest.ai === "object" && manifest.ai !== null) {
        const ai = manifest.ai as Record<string, unknown>;
        for (const field of V1_AI_FIELDS) {
            if (hasField(ai, field)) errors.push(v1AiFieldError(field));
        }
    }

    return errors;
}
