import { z } from "zod";
import { weightSchema } from "./source-manifest.js";

export const mergeStrategySchema = z.enum([
  "replace",
  "deep",
  "append",
  "prepend",
  "skip",
  "prompt",
  "directory",
  "import",
], {
  errorMap: () => ({ message: "Merge strategy must be one of: replace, deep, append, prepend, skip, prompt, directory, import" }),
});

export const scopeSchema = z.enum(["project", "global"], {
  errorMap: () => ({ message: "Scope must be either 'project' or 'global'" }),
});

const skillItemSchema = z.object({
  name: z.string().min(1, "Skill name cannot be empty").max(64, "Skill name must be 64 characters or less"),
  scope: scopeSchema,
});

const rulesSchema = z.union([
  z.array(z.string().min(1, "Rule path cannot be empty"), {
    invalid_type_error: "Rules must be an array of strings or an object mapping tool keys to rule arrays",
  }),
  z.record(z.string().min(1, "Tool key cannot be empty"), z.array(z.string().min(1, "Rule path cannot be empty")).optional()),
]);

const agentsSchema = z.union([
  z.array(z.string().min(1, "Agent path cannot be empty"), {
    invalid_type_error: "Agents must be an array of strings or an object mapping tool keys to agent arrays",
  }),
  z.record(z.string().min(1, "Tool key cannot be empty"), z.array(z.string().min(1, "Agent path cannot be empty")).optional()),
]);

const memoryItemSchema = z.object({
  source: z.string().min(1, "Memory source filename cannot be empty").max(128, "Memory source filename must be 128 characters or less"),
  merge: mergeStrategySchema,
});

const memorySectionSchema = z.array(memoryItemSchema).max(10, "Cannot have more than 10 memory files").optional();

const aiSectionSchema = z
  .object({
    tools: z.array(z.string().min(1, "Tool key cannot be empty")).max(50, "Cannot specify more than 50 AI tools").optional(),
    skills: z.array(skillItemSchema).max(100, "Cannot have more than 100 skills").optional(),
    rules: rulesSchema.optional(),
    agents: agentsSchema.optional(),
    memory: memorySectionSchema,
    commands: z.array(z.string().min(1, "Command name cannot be empty")).max(100, "Cannot have more than 100 commands").optional(),
  })
  .optional();

const fileConfigItemSchema = z.object({
  source: z.string().min(1, "File source path cannot be empty").max(256, "File source path must be 256 characters or less"),
  target: z.string().max(256, "File target path must be 256 characters or less").optional(),
  merge: mergeStrategySchema,
});

const filesSectionSchema = z.array(fileConfigItemSchema).max(100, "Cannot have more than 100 file configurations").optional();

const ideSectionSchema = z.record(z.string().min(1, "IDE key cannot be empty"), z.array(z.string().min(1, "Filename cannot be empty"))).optional();

import { KEBAB_CASE_REGEX, SEMVER_REGEX } from "./constants.js";
export { KEBAB_CASE_REGEX } from "./constants.js";

const profileNameSchema = z.string().min(1, "Profile name cannot be empty").max(64, "Profile name must be 64 characters or less").regex(KEBAB_CASE_REGEX, {
  message: "Profile name must be kebab-case (e.g., my-profile). Use lowercase letters, numbers, and hyphens only. Cannot start or end with a hyphen.",
});

const profileVersionSchema = z.string().min(1, "Version cannot be empty").regex(SEMVER_REGEX, {
  message: "Version must be a valid semver string (e.g., 1.0.0, 2.1.3)",
});

export const profileManifestSchema = z.object({
  name: profileNameSchema,
  version: profileVersionSchema,
  description: z.string().max(500, "Description must be 500 characters or less").optional(),
  extends: z
    .union([z.string().min(1, "Extends source cannot be empty"), z.array(z.string().min(1, "Extends source cannot be empty")).min(1, "Extends array cannot be empty")])
    .transform((val) => (typeof val === "string" ? [val] : val))
    .optional(),
  weight: weightSchema.optional(),
  ai: aiSectionSchema,
  files: filesSectionSchema,
  ide: ideSectionSchema,
  variables: z.record(z.string().min(1, "Variable name cannot be empty"), z.string()).max(50, "Cannot have more than 50 variables").optional(),
  hooks: z
    .object({
      "post-install": z.string().max(1024, "Hook command must be 1024 characters or less").optional(),
      "post-update": z.string().max(1024, "Hook command must be 1024 characters or less").optional(),
    })
    .optional(),
}).superRefine((manifest, ctx) => {
  if (manifest.extends && manifest.extends.length > 10) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Cannot extend more than 10 profiles",
      path: ["extends"],
    });
  }

  if (manifest.ai?.tools) {
    const seen = new Set<string>();
    for (const tool of manifest.ai.tools) {
      if (seen.has(tool)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate AI tool "${tool}" found`,
          path: ["ai", "tools"],
        });
      }
      seen.add(tool);
    }
  }

  if (manifest.ai?.skills) {
    const seen = new Set<string>();
    for (const skill of manifest.ai.skills) {
      if (seen.has(skill.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate skill "${skill.name}" found`,
          path: ["ai", "skills"],
        });
      }
      seen.add(skill.name);
    }
  }

  if (manifest.files) {
    const seen = new Set<string>();
    for (const file of manifest.files) {
      const target = file.target || file.source;
      if (seen.has(target)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate file target "${target}" found`,
          path: ["files"],
        });
      }
      seen.add(target);
    }
  }

  if (manifest.variables) {
    for (const varName of Object.keys(manifest.variables)) {
      if (!/^[A-Z_][A-Z0-9_]*$/.test(varName) && !/^[a-z_][a-z0-9_]*$/.test(varName)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Variable "${varName}" should use UPPER_SNAKE_CASE or lower_snake_case`,
          path: ["variables", varName],
        });
      }
    }
  }
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
