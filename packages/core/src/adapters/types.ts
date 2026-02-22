import type { ConfigType, Scope } from "@baton-dx/ai-tool-paths";

/**
 * Type guards for config file types used in adapter validate() methods.
 * These replace unsafe `as` casts with runtime narrowing.
 */
export function isSkillDir(file: unknown): file is SkillDir {
  return typeof file === "object" && file !== null && "name" in file && "skillFile" in file;
}

export function isRuleFile(file: unknown): file is RuleFile {
  return typeof file === "object" && file !== null && "name" in file && "content" in file;
}

export function isAgentFile(file: unknown): file is AgentFile {
  return typeof file === "object" && file !== null && "name" in file && "frontmatter" in file;
}

export function isMemoryFile(file: unknown): file is MemoryFile {
  return typeof file === "object" && file !== null && "filename" in file && "content" in file;
}

export function isCommandFile(file: unknown): file is CommandFile {
  return typeof file === "object" && file !== null && "name" in file && "content" in file;
}

/**
 * Validation result returned by adapter validate() methods
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Skill directory structure - canonical format
 * Skills are directories with SKILL.md and optional scripts/
 */
export interface SkillDir {
  name: string;
  /** Path to SKILL.md file */
  skillFile: string;
  /** All file paths in the skill directory */
  files: string[];
}

/**
 * Rule file - canonical format
 * Rules are Markdown files with optional YAML frontmatter
 */
export interface RuleFile {
  name: string;
  /** Rule content (with or without YAML frontmatter) */
  content: string;
  /** Optional YAML frontmatter data */
  frontmatter?: {
    paths?: string[];
    globs?: string[];
    alwaysApply?: boolean;
    [key: string]: unknown;
  };
}

/**
 * Agent file - canonical format
 * Agents are Markdown files with YAML frontmatter
 */
export interface AgentFile {
  name: string;
  /** Agent description */
  description?: string;
  /** Agent content */
  content: string;
  /** YAML frontmatter data */
  frontmatter: {
    name: string;
    description?: string;
    tools?: string[];
    model?: string;
    [key: string]: unknown;
  };
}

/**
 * Memory file - canonical format
 * Memory files are Markdown files (CLAUDE.md, AGENTS.md, GEMINI.md, etc.)
 */
export interface MemoryFile {
  /** Filename (e.g., CLAUDE.md, AGENTS.md) */
  filename: string;
  /** Memory content */
  content: string;
}

/**
 * Command file - canonical format
 * Commands are Markdown files (slash commands)
 */
export interface CommandFile {
  name: string;
  /** Command content */
  content: string;
}

/**
 * AIToolAdapter interface - all AI tool adapters implement this
 *
 * Each adapter handles the specifics of transforming canonical data formats
 * into the format expected by a specific AI tool (Claude Code, Cursor, etc.)
 */
export interface AIToolAdapter {
  /** Unique tool key (e.g., 'claude-code', 'cursor') */
  key: string;

  /** Human-readable tool name (e.g., 'Claude Code', 'Cursor') */
  name: string;

  /**
   * Check if this tool is installed on the system
   * Checks for CLI binary in PATH and/or config directory existence
   */
  isInstalled(): Promise<boolean>;

  /**
   * Get the path where a config file should be placed
   * @param type - Config type (skills, rules, agents, memory, settings, commands)
   * @param scope - Scope (project or global)
   * @param name - Name of the config item (for placeholder replacement)
   * @returns Absolute path where the file should be placed
   */
  getPath(type: ConfigType, scope: Scope, name: string): string;

  /**
   * Get legacy paths for backward compatibility
   * @param type - Config type
   * @returns Array of legacy path strings (e.g., ['.cursorrules'])
   */
  getLegacyPaths(type: ConfigType): string[];

  /**
   * Transform a skill from canonical format to tool-specific format
   * @param skill - Canonical skill directory structure
   * @returns Transformed skill content (may be unchanged for 1:1 copy)
   */
  transformSkill(skill: SkillDir): SkillDir;

  /**
   * Transform a rule from canonical format to tool-specific format
   * @param rule - Canonical rule file
   * @returns Transformed rule content
   */
  transformRule(rule: RuleFile): RuleFile;

  /**
   * Transform an agent from canonical format to tool-specific format
   * @param agent - Canonical agent file
   * @returns Transformed agent content
   */
  transformAgent(agent: AgentFile): AgentFile;

  /**
   * Transform a memory file from canonical format to tool-specific format
   * @param memory - Canonical memory file
   * @returns Transformed memory content
   */
  transformMemory(memory: MemoryFile): MemoryFile;

  /**
   * Transform a command from canonical format to tool-specific format
   * @param command - Canonical command file
   * @returns Transformed command content
   */
  transformCommand(command: CommandFile): CommandFile;

  /**
   * Validate that a file matches the tool's expected format
   * @param type - Config type
   * @param file - File content to validate
   * @returns Validation result with errors
   */
  validate(type: ConfigType, file: unknown): ValidationResult;
}
