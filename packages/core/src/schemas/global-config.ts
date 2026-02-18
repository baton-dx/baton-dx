import { z } from "zod";

/**
 * Schema for a single global source entry in ~/.baton/config.yaml
 *
 * Represents a registered source repository that can be used across projects.
 * Sources can be marked as default for auto-selection in `baton init`.
 */
export const globalSourceEntrySchema = z.object({
  /** Friendly name for the source (e.g., "acme", "personal") */
  name: z.string(),

  /** Source URL (e.g., "github:org/repo", "../local/path") */
  url: z.string(),

  /** Whether this source should be used by default in `baton init` */
  default: z.boolean().default(false),

  /** Optional description of the source purpose */
  description: z.string().optional(),
});

/**
 * Schema for ~/.baton/config.yaml - global Baton configuration
 *
 * Stores user-level settings like registered sources, cache config, and defaults.
 */
export const globalConfigSchema = z.object({
  /** Config file format version (for future migrations) */
  version: z.string().default("1.0"),

  /** Registered source repositories available globally */
  sources: z.array(globalSourceEntrySchema).optional().default([]),

  /** Cache configuration */
  cache: z
    .object({
      /** Cache directory location (supports ~ expansion) */
      location: z.string().default("~/.baton/cache"),

      /** Cache TTL in seconds (default: 24 hours) */
      ttl: z.number().default(86400),
    })
    .optional(),

  /** Default settings for profile installation */
  defaults: z
    .object({
      /** Default scope for profile installation */
      scope: z.enum(["project", "global"]).default("project"),

      /** Default merge strategy when conflicts occur */
      merge_strategy: z
        .enum(["replace", "deep", "append", "prepend", "skip", "prompt", "directory", "import"])
        .default("deep"),
    })
    .optional(),

  /** AI tool configuration — persisted tool selection */
  ai: z
    .object({
      /** List of AI tool keys the developer uses (e.g., ["claude-code", "cursor"]) */
      tools: z.array(z.string()).optional().default([]),
    })
    .optional(),

  /** IDE platform configuration — persisted platform selection */
  ide: z
    .object({
      /** List of IDE platform keys the developer uses (e.g., ["vscode", "cursor"]) */
      platforms: z.array(z.string()).optional().default([]),
    })
    .optional(),
});

export type GlobalConfig = z.infer<typeof globalConfigSchema>;
export type GlobalSourceEntry = z.infer<typeof globalSourceEntrySchema>;
