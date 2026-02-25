import { z } from "zod";
import { weightSchema } from "./source-manifest.js";

/**
 * Merge strategy types for file merging
 */
export const mergeStrategySchema = z.enum([
  "replace",
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
 * AI section in profile manifest
 */
const aiSectionSchema = z
  .object({
    tools: z.array(z.string()).optional(), // Target AI tools (e.g., ["claude-code", "cursor"])
    skills: z.array(skillItemSchema).optional(),
    rules: rulesSchema.optional(),
    agents: agentsSchema.optional(),
    memory: memorySectionSchema.optional(),
    commands: z.array(z.string()).optional(),
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
    .union([z.string(), z.array(z.string())])
    .transform((val) => (typeof val === "string" ? [val] : val))
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
