/**
 * Configuration type union - represents all types of configurations
 * that can be managed by Baton
 */
export type ConfigType = "skills" | "rules" | "agents" | "memory" | "settings" | "commands";

/**
 * Scope for configuration items
 */
export type Scope = "project" | "global";

/**
 * Error thrown when an agent is not found in the registry
 */
export class AgentNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentNotFoundError";
  }
}

/**
 * Path configuration for a single agent.
 */
export interface AgentPathConfig {
  /** Unique key identifying the agent (e.g., 'claude-code', 'cursor') */
  key: string;
  /** Human-readable name of the agent */
  name: string;
  /** Paths for skills configuration */
  skills: {
    /** Project-level skills path (relative to project root) */
    project: string;
    /** Global skills path (user home directory, ~/...) */
    global: string;
  };
  /** Paths for rules configuration */
  rules: {
    /** Project-level rules path */
    project: string;
    /** Global rules path */
    global: string;
  };
  /** Paths for agents configuration */
  agents: {
    /** Project-level agents path */
    project: string;
    /** Global agents path */
    global: string;
  };
  /** Paths for memory files (e.g., CLAUDE.md, AGENTS.md) */
  memory: {
    /** Project-level memory path */
    project: string;
    /** Global memory path */
    global: string;
  };
  /** Paths for settings configuration */
  settings: {
    /** Project-level settings path */
    project: string;
    /** Global settings path */
    global: string;
  };
  /** Paths for commands/workflows */
  commands: {
    /** Project-level commands path */
    project: string;
    /** Global commands path */
    global: string;
  };
  /** Detection methods for checking if this agent is installed */
  detection: string[];
  /** Legacy paths for backward compatibility (e.g., .cursorrules, .windsurfrules) */
  legacy: {
    /** Legacy rules paths */
    rules?: string[];
    /** Legacy memory paths */
    memory?: string[];
    /** Legacy settings paths */
    settings?: string[];
  };
}
