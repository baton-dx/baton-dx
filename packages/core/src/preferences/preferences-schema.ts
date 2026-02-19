import { z } from "zod";

/**
 * Schema for .baton/preferences.yaml - project-level tool and IDE preferences
 *
 * Controls which AI tools and IDE platforms Baton configures for this project.
 * Resolution chain: Detection -> Global Config -> Project Preferences
 */
export const projectPreferencesSchema = z.object({
  /** Config file format version */
  version: z.literal("1.0"),

  /** AI tool preferences */
  ai: z
    .object({
      /** When true, use global config instead of project-level tools */
      useGlobal: z.boolean(),

      /** List of AI tool keys (e.g., ["claude-code", "cursor"]) */
      tools: z.array(z.string()).default([]),
    })
    .default({ useGlobal: true, tools: [] }),

  /** IDE platform preferences */
  ide: z
    .object({
      /** When true, use global config instead of project-level platforms */
      useGlobal: z.boolean(),

      /** List of IDE platform keys (e.g., ["vscode", "cursor"]) */
      platforms: z.array(z.string()).default([]),
    })
    .default({ useGlobal: true, platforms: [] }),
});

export type ProjectPreferences = z.infer<typeof projectPreferencesSchema>;
