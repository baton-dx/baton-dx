import { mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { atomicWriteFile } from "../utils/atomic-write.js";

export interface SharedSettingsResult {
  written: boolean;
  warnings: string[];
}

/**
 * Read-modify-write a shared settings JSON file to update MCP server entries.
 *
 * This is used for tools that embed MCP config in a larger settings file
 * (Zed: settings.json, Cline: mcp.json, Antigravity: settings.json, Codex: config.toml handled separately).
 *
 * Safety guarantees:
 * - Only removes server names from `previousServerNames` (user's manual entries are preserved)
 * - Bails on JSON parse errors (does not overwrite corrupted files)
 * - Idempotent: no write if content would be unchanged
 * - Creates file if it doesn't exist (when servers is non-empty)
 *
 * @param filePath - Absolute path to the shared settings file
 * @param mcpKey - Dot-separated key path for the MCP servers object (e.g., "mcpServers", "context_servers")
 * @param batchedServers - New server entries to place (name → config)
 * @param previousServerNames - Server names Baton managed in the previous sync (to remove)
 */
export async function readModifyWriteSharedSettings(
  filePath: string,
  mcpKey: string,
  batchedServers: Record<string, object>,
  previousServerNames: string[],
): Promise<SharedSettingsResult> {
  const warnings: string[] = [];

  // Read existing file or start with empty object
  let existing: Record<string, unknown> = {};
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      warnings.push(
        `MCP: ${filePath} does not contain a JSON object — skipping to avoid data loss`,
      );
      return { written: false, warnings };
    }
    existing = parsed as Record<string, unknown>;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      // File doesn't exist — start fresh only if we have servers to write
      if (Object.keys(batchedServers).length === 0) {
        return { written: false, warnings };
      }
    } else if (err instanceof SyntaxError) {
      warnings.push(`MCP: ${filePath} contains invalid JSON — skipping to avoid data loss`);
      return { written: false, warnings };
    } else {
      throw err;
    }
  }

  // Navigate to the MCP servers key (supports dot-separated paths like "amp.mcpServers")
  const keyParts = mcpKey.split(".");
  const parentKeys = keyParts.slice(0, -1);
  const leafKey = keyParts[keyParts.length - 1];

  // Ensure parent path exists
  let parent = existing;
  for (const part of parentKeys) {
    if (typeof parent[part] !== "object" || parent[part] === null) {
      parent[part] = {};
    }
    parent = parent[part] as Record<string, unknown>;
  }

  // Get existing MCP servers object
  const existingServers = (parent[leafKey] as Record<string, unknown> | undefined) ?? {};

  // Build new servers: start with existing, remove baton-managed ones, add new ones
  const newServers: Record<string, unknown> = {};

  // Keep non-baton-managed entries
  for (const [name, config] of Object.entries(existingServers)) {
    if (!previousServerNames.includes(name)) {
      newServers[name] = config;
    }
  }

  // Add new baton-managed entries
  for (const [name, config] of Object.entries(batchedServers)) {
    newServers[name] = config;
  }

  // Idempotency check: skip write if content unchanged
  const updatedSettings = { ...existing };
  let cursor = updatedSettings as Record<string, unknown>;
  for (const part of parentKeys) {
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[leafKey] = newServers;

  const newJson = `${JSON.stringify(updatedSettings, null, 2)}\n`;
  const existingJson = `${JSON.stringify(existing, null, 2)}\n`;

  if (Object.keys(newServers).length === 0 && !existingServers) {
    return { written: false, warnings };
  }

  if (newJson === existingJson) {
    return { written: false, warnings };
  }

  // Write atomically
  await mkdir(dirname(filePath), { recursive: true });
  await atomicWriteFile(filePath, newJson);

  return { written: true, warnings };
}
