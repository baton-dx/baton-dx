import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { atomicWriteFile } from "../utils/atomic-write.js";

/**
 * Write MCP servers to a dedicated JSON file (atomic write).
 *
 * Output shape:
 * ```json
 * {
 *   "mcpServers": {
 *     "github": { "command": "npx", "args": ["..."] }
 *   }
 * }
 * ```
 *
 * @param filePath - Absolute path to the target JSON file
 * @param configKey - Top-level key for the servers object (e.g., "mcpServers", "servers")
 * @param servers - Map of server name → server config object
 * @param nestedPath - Optional dot-separated key for nested config (e.g., "amp" for "amp.mcpServers")
 */
export async function writeMcpJson(
  filePath: string,
  configKey: string,
  servers: Record<string, object>,
  nestedPath?: string,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });

  let content: Record<string, unknown>;

  if (nestedPath) {
    // Build nested structure: { "amp": { "mcpServers": { ... } } }
    const parts = nestedPath.split(".");
    content = {};
    let current = content as Record<string, unknown>;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      current[part] = {};
      current = current[part] as Record<string, unknown>;
    }
    current[configKey] = servers;
  } else {
    content = { [configKey]: servers };
  }

  await atomicWriteFile(filePath, `${JSON.stringify(content, null, 2)}\n`);
}

/**
 * Write MCP servers to a dedicated JSONC file (atomic write).
 * Writes clean JSON without comments — JSONC is a superset so this is valid.
 * Comments from previous Baton-managed sections are NOT preserved (no round-trip support).
 *
 * @param filePath - Absolute path to the target JSONC file
 * @param configKey - Top-level key for the servers object
 * @param servers - Map of server name → server config object
 */
export async function writeMcpJsonc(
  filePath: string,
  configKey: string,
  servers: Record<string, object>,
): Promise<void> {
  await writeMcpJson(filePath, configKey, servers);
}

/**
 * Write MCP servers to a TOML config file section (atomic write).
 * Produces a [[mcp_servers]] array-of-tables section.
 *
 * Note: This is a standalone writer for Codex config, not a shared-settings writer.
 * For read-modify-write of existing TOML files, use shared-settings.ts.
 *
 * @param filePath - Absolute path to the target TOML file
 * @param servers - Array of server config objects with `name` field
 */
export async function writeMcpToml(
  filePath: string,
  servers: Array<{
    name: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
  }>,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });

  const lines: string[] = [];

  for (const server of servers) {
    lines.push("[[mcp_servers]]");
    lines.push(`name = ${tomlString(server.name)}`);

    if (server.url) {
      lines.push(`url = ${tomlString(server.url)}`);
    }

    if (server.command) {
      lines.push(`command = ${tomlString(server.command)}`);
    }

    if (server.args && server.args.length > 0) {
      const argsStr = server.args.map(tomlString).join(", ");
      lines.push(`args = [${argsStr}]`);
    }

    if (server.env && Object.keys(server.env).length > 0) {
      lines.push("[mcp_servers.env]");
      for (const [k, v] of Object.entries(server.env)) {
        lines.push(`${k} = ${tomlString(v)}`);
      }
    }

    lines.push(""); // blank line between entries
  }

  await atomicWriteFile(filePath, lines.join("\n"));
}

function tomlString(s: string): string {
  // Use double-quoted TOML string with minimal escaping
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
}
