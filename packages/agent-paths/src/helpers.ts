import { homedir } from "node:os";
import { AGENT_PATHS } from "./registry.js";
import { AgentNotFoundError, type AgentPathConfig, type ConfigType, type Scope } from "./types.js";

/**
 * Retrieves the full agent configuration for a given agent key.
 *
 * @param agentKey - The unique key of the agent (e.g., 'claude-code', 'cursor')
 * @returns The full AgentPathConfig for the agent
 * @throws AgentNotFoundError if the agent key is not found in the registry
 */
export function getAgentConfig(agentKey: string): AgentPathConfig {
  const config = AGENT_PATHS.find((agent) => agent.key === agentKey);
  if (!config) {
    throw new AgentNotFoundError(`Agent with key '${agentKey}' not found in registry`);
  }
  return config;
}

/**
 * Returns an array of all registered agent keys.
 *
 * @returns Array of all agent keys
 */
export function getAllAgentKeys(): string[] {
  return AGENT_PATHS.map((agent) => agent.key);
}

/**
 * Resolves a path template with tilde expansion and name placeholder replacement.
 *
 * @param template - The path template (e.g., '~/.claude/skills/{name}')
 * @param name - Optional name to replace {name} placeholder with
 * @returns Resolved path string
 */
function resolvePath(template: string, name?: string): string {
  let resolved = template;

  // Replace {name} placeholder
  if (name) {
    resolved = resolved.replace(/\{name\}/g, name);
  }

  // Expand tilde to home directory
  if (resolved.startsWith("~/")) {
    resolved = resolved.replace(/^~/, homedir());
  }

  return resolved;
}

/**
 * Retrieves the resolved path for a given agent, config type, scope, and optional name.
 *
 * @param agentKey - The unique key of the agent
 * @param configType - The type of configuration (skills, rules, agents, memory, settings, commands)
 * @param scope - The scope (project or global)
 * @param name - Optional name to replace {name} placeholder
 * @returns Resolved path string
 * @throws AgentNotFoundError if the agent key is not found
 */
export function getAgentPath(
  agentKey: string,
  configType: ConfigType,
  scope: Scope,
  name?: string,
): string {
  const config = getAgentConfig(agentKey);
  const pathConfig: { project: string; global: string } = config[configType];
  const pathTemplate = pathConfig[scope];
  return resolvePath(pathTemplate, name);
}

/**
 * Retrieves legacy paths for a given agent and config type.
 *
 * @param agentKey - The unique key of the agent
 * @param configType - The type of configuration (only rules, memory, settings have legacy paths)
 * @returns Array of legacy path strings (empty if none exist)
 * @throws AgentNotFoundError if the agent key is not found
 */
export function getLegacyPaths(agentKey: string, configType: ConfigType): string[] {
  const config = getAgentConfig(agentKey);
  if (configType in config.legacy) {
    const legacyPaths = config.legacy[configType as keyof typeof config.legacy];
    return legacyPaths ?? [];
  }
  return [];
}
