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
 * Platform identifier for platform-specific detection checks
 */
export type Platform = "darwin" | "linux" | "win32";

/**
 * Check for a binary in PATH, optionally verifying its identity via version output.
 * Prevents false positives from binary name collisions (e.g., `opencode` by Litestar vs SST).
 */
export interface BinaryCheck {
  readonly type: "binary";
  readonly name: string;
  readonly versionFlag?: string;
  readonly versionPattern?: RegExp;
  readonly platforms?: readonly Platform[];
}

/**
 * Check for a directory's existence, optionally requiring a marker file.
 * Prevents false positives from leftover empty directories.
 */
export interface DirectoryCheck {
  readonly type: "directory";
  readonly path: string;
  readonly markerFile?: string;
  readonly platforms?: readonly Platform[];
}

/**
 * Check for a macOS .app bundle in /Applications or ~/Applications.
 */
export interface AppBundleCheck {
  readonly type: "app";
  readonly name: string;
  readonly searchPaths?: readonly string[];
}

/**
 * Check for a VS Code extension installed in VS Code, Cursor, or Windsurf.
 */
export interface VscodeExtensionCheck {
  readonly type: "vscode-extension";
  readonly extensionId: string;
  readonly editors?: readonly ("vscode" | "cursor" | "windsurf")[];
}

/**
 * Check for a JetBrains plugin installed across any JetBrains IDE version.
 */
export interface JetbrainsPluginCheck {
  readonly type: "jetbrains-plugin";
  readonly pluginId: string;
}

/**
 * Union of all detection check types.
 */
export type DetectionCheck =
  | BinaryCheck
  | DirectoryCheck
  | AppBundleCheck
  | VscodeExtensionCheck
  | JetbrainsPluginCheck;

/**
 * Detection configuration using OR-of-ANDs logic.
 * Each group is an AND (all checks must pass).
 * Any group passing means the tool is detected (OR across groups).
 */
export interface DetectionConfig {
  readonly groups: readonly (readonly DetectionCheck[])[];
}

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
  /** Structured detection configuration using OR-of-ANDs logic */
  detectionConfig?: DetectionConfig;
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
