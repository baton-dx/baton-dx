import { z } from "zod";
import { KEBAB_CASE_REGEX, SEMVER_REGEX } from "./constants.js";

export const weightSchema = z.number().int().min(-1).default(0);

const nameSchema = z.string().min(1, "Source name cannot be empty").max(64, "Source name must be 64 characters or less").regex(KEBAB_CASE_REGEX, {
  message: "Source name must be kebab-case (e.g., my-source). Use lowercase letters, numbers, and hyphens only. Cannot start or end with a hyphen.",
});

const versionSchema = z.string().min(1, "Version cannot be empty").regex(SEMVER_REGEX, {
  message: "Version must be a valid semver string (e.g., 1.0.0, 2.1.3)",
});

const descriptionSchema = z.string().max(500, "Description must be 500 characters or less").optional();

const repositorySchema = z.string().url("Repository must be a valid URL").optional().or(z.literal(""));

const sourceProfileEntrySchema = z.object({
  name: z.string().min(1, "Profile name cannot be empty"),
  path: z.string().min(1, "Profile path cannot be empty"),
  description: descriptionSchema,
  weight: weightSchema.optional(),
});

const sourceAiSectionSchema = z
  .object({
    tools: z.array(z.string().min(1, "Tool key cannot be empty"), {
      invalid_type_error: "AI tools must be an array of strings",
    }).max(50, "Cannot specify more than 50 AI tools").optional(),
  })
  .optional();

const sourceIdeSectionSchema = z
  .object({
    platforms: z.array(z.string().min(1, "Platform key cannot be empty"), {
      invalid_type_error: "IDE platforms must be an array of strings",
    }).max(20, "Cannot specify more than 20 IDE platforms").optional(),
  })
  .optional();

export const sourceManifestSchema = z.object({
  name: nameSchema,
  version: versionSchema,
  description: descriptionSchema,
  repository: repositorySchema,
  ai: sourceAiSectionSchema,
  ide: sourceIdeSectionSchema,
  profiles: z.array(sourceProfileEntrySchema).max(100, "Cannot have more than 100 profiles").optional(),
  metadata: z.record(z.string().min(1, "Metadata key cannot be empty"), z.string()).max(50, "Cannot have more than 50 metadata entries").optional(),
}).superRefine((manifest, ctx) => {
  if (manifest.ai?.tools) {
    const seen = new Set<string>();
    for (const tool of manifest.ai.tools) {
      if (seen.has(tool)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate AI tool "${tool}" found. Each tool should be listed only once.`,
          path: ["ai", "tools"],
        });
      }
      seen.add(tool);
    }
  }

  if (manifest.ide?.platforms) {
    const seen = new Set<string>();
    for (const platform of manifest.ide.platforms) {
      if (seen.has(platform)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate IDE platform "${platform}" found. Each platform should be listed only once.`,
          path: ["ide", "platforms"],
        });
      }
      seen.add(platform);
    }
  }

  if (manifest.profiles) {
    const seen = new Set<string>();
    for (const profile of manifest.profiles) {
      if (seen.has(profile.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate profile name "${profile.name}" found. Each profile should have a unique name.`,
          path: ["profiles"],
        });
      }
      seen.add(profile.name);
    }
  }
});
