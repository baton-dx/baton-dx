import { z } from "zod";
import { scopeSchema } from "./profile-manifest.js";

/**
 * Profile source with optional version
 */
const profileSourceSchema = z.object({
  source: z.string(), // e.g., "github:org/repo", "./local/path", "https://git.example.com/repo.git"
  version: z.string().optional(), // e.g., "^1.0.0", "@v2.0", "@main", "latest"
});

/**
 * Extras section for individual skills and agents
 */
const extrasSectionSchema = z
  .object({
    skills: z
      .array(
        z.object({
          source: z.string(),
          scope: scopeSchema,
        }),
      )
      .optional(),
  })
  .optional();

/**
 * Overrides section - flexible object for tooling and AI overrides
 */
const overridesSectionSchema = z.record(z.unknown()).optional();

/**
 * Project manifest schema (baton.yaml)
 */
export const projectManifestSchema = z.object({
  profiles: z.array(profileSourceSchema),
  extras: extrasSectionSchema,
  overrides: overridesSectionSchema,
  variables: z.record(z.string(), z.string()).optional(),
  /**
   * Controls which categories of baton-managed files are added to .gitignore.
   *
   * Simple form (backward-compatible):
   *   gitignore: true   → all categories enabled (ai-tools, ides; files: false)
   *   gitignore: false  → all categories disabled
   *
   * Granular form:
   *   gitignore:
   *     ai-tools: true   # default: true — AI tool configs (.claude/, .cursor/, ...)
   *     ides: true        # default: true — IDE configs (.vscode/, .idea/, ...)
   *     files: false      # default: false — custom files (biome.json, etc.) stay committed
   */
  gitignore: z
    .union([
      z.boolean(),
      z.object({
        "ai-tools": z.boolean().optional(),
        ides: z.boolean().optional(),
        files: z.boolean().optional(),
      }),
    ])
    .optional(),
});

/**
 * Inferred TypeScript type for project manifest
 */
export type ProjectManifest = z.infer<typeof projectManifestSchema>;
