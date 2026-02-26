import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse, stringify } from "yaml";
import { z } from "zod";
import { atomicWriteFile } from "../utils/atomic-write.js";

/**
 * Schema for `.baton/state.yaml` — local placement state (never committed).
 *
 * Tracks which tool-specific files were placed on disk during the last sync/apply,
 * categorized by type for targeted gitignore and cleanup support.
 */
export const placementStateSchema = z.object({
  synced_at: z.string().describe("ISO 8601 timestamp of the last sync/apply"),
  tools: z.array(z.string()).describe("AI tool keys that were synced"),
  placed_files: z
    .object({
      "ai-tools": z
        .array(z.string())
        .describe("Paths placed for AI tool adapters (.claude/, .cursor/, ...)"),
      ides: z.array(z.string()).describe("Paths placed for IDE platforms (.vscode/, .idea/, ...)"),
      files: z
        .array(z.string())
        .describe("Paths placed from profile files sections (biome.json, tsconfig.json, ...)"),
    })
    .describe("Tool-specific relative paths placed on disk, grouped by category"),
  /**
   * MCP servers placed per tool in the last sync.
   * Map of tool key → array of server names managed by Baton.
   * Used on the next sync to remove stale servers from shared settings files.
   */
  mcp_servers: z
    .record(z.string(), z.array(z.string()))
    .optional()
    .describe("Baton-managed MCP server names per tool key (e.g., { 'zed': ['github', 'fs'] })"),
});

export type PlacementState = z.infer<typeof placementStateSchema>;

const STATE_DIR = ".baton";
const STATE_FILE = "state.yaml";

/** Resolve the absolute path to `.baton/state.yaml` for a given project root. */
export function getStatePath(projectRoot: string): string {
  return resolve(projectRoot, STATE_DIR, STATE_FILE);
}

/**
 * Read the local placement state from `.baton/state.yaml`.
 * Returns `null` if the file does not exist or is invalid.
 */
export async function readState(projectRoot: string): Promise<PlacementState | null> {
  try {
    const content = await readFile(getStatePath(projectRoot), "utf-8");
    const parsed = parse(content);
    const result = placementStateSchema.safeParse(parsed);
    if (!result.success) {
      return null;
    }
    return result.data;
  } catch {
    return null;
  }
}

/**
 * Write local placement state to `.baton/state.yaml`.
 * The `.baton/` directory is already gitignored by `ensureBatonDirGitignored()`.
 */
export async function writeState(projectRoot: string, state: PlacementState): Promise<void> {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(resolve(projectRoot, STATE_DIR), { recursive: true });
  const yamlContent = stringify(state);
  await atomicWriteFile(getStatePath(projectRoot), yamlContent);
}

/**
 * Flatten all placement categories into a single set of paths.
 * Used for orphan detection, which compares a flat set of previous vs current paths.
 */
export function flattenPlacedFiles(placedFiles: PlacementState["placed_files"]): string[] {
  return [...placedFiles["ai-tools"], ...placedFiles.ides, ...placedFiles.files];
}
