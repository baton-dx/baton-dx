import type { ConfigType, Scope } from "@baton-dx/ai-tool-paths";
import { getAIToolMcpPath, getAIToolPath } from "@baton-dx/ai-tool-paths";
import type { MergedMcpServer } from "../merge/mcp.js";
import { transformEnvVars } from "../mcp/env-transform.js";
import type {
  AgentFile,
  AIToolAdapter,
  CommandFile,
  McpCapabilities,
  McpEnvVarSyntax,
  MemoryFile,
  RuleFile,
  SkillDir,
  ToolMcpServer,
  ValidationResult,
} from "./types.js";

/**
 * Base adapter with default implementations for the AIToolAdapter interface.
 *
 * Provides:
 * - isInstalled() via detectInstalledAITools()
 * - getPath() via getAIToolPath()
 * - getLegacyPaths() returns []
 * - transform*() passthrough (return input unchanged)
 * - transformMemory() converts MEMORY.md to this.memoryFilename
 * - validate() with common type-specific validation
 *
 * Subclasses only need to define `key` and `name`.
 * Override `memoryFilename` for tools that don't use AGENTS.md.
 */
export abstract class BaseAIToolAdapter implements AIToolAdapter {
  abstract readonly key: string;
  abstract readonly name: string;

  /** Memory filename this tool uses. Override for non-AGENTS.md tools. */
  protected memoryFilename = "AGENTS.md";

  /** Default MCP capabilities: unsupported. Override in subclasses. */
  readonly mcpCapabilities: McpCapabilities = {
    supported: false,
    configKey: "mcpServers",
    envVarSyntax: "dollar-brace",
    format: "json",
    sharedSettingsFile: false,
    supportedScopes: ["project", "global"],
  };

  async isInstalled(): Promise<boolean> {
    try {
      const { detectInstalledAITools } = await import("../detection/ai-tool-detection.js");
      const installed = await detectInstalledAITools();
      return installed.includes(this.key);
    } catch {
      return false;
    }
  }

  getPath(type: ConfigType, scope: Scope, name: string): string {
    return getAIToolPath(this.key, type, scope, name);
  }

  getLegacyPaths(_type: ConfigType): string[] {
    return [];
  }

  transformSkill(skill: SkillDir): SkillDir {
    return skill;
  }

  transformRule(rule: RuleFile): RuleFile {
    return rule;
  }

  transformAgent(agent: AgentFile): AgentFile {
    return agent;
  }

  transformMemory(memory: MemoryFile): MemoryFile {
    if (memory.filename === "MEMORY.md") {
      return {
        ...memory,
        filename: this.memoryFilename,
      };
    }
    return memory;
  }

  transformCommand(command: CommandFile): CommandFile {
    return command;
  }

  validate(type: ConfigType, file: unknown): ValidationResult {
    return this.validateCommon(type, file);
  }

  getMcpPath(scope: Scope): string | null {
    if (!this.mcpCapabilities.supported) return null;
    return getAIToolMcpPath(this.key, scope);
  }

  transformMcp(server: MergedMcpServer): ToolMcpServer | null {
    if (!this.mcpCapabilities.supported) return null;
    return this.buildMcpServer(server, this.mcpCapabilities.envVarSyntax);
  }

  /**
   * Build a ToolMcpServer object from a MergedMcpServer, transforming env-var syntax.
   * Subclasses can call this with a custom syntax override if needed.
   */
  protected buildMcpServer(server: MergedMcpServer, syntax: McpEnvVarSyntax): ToolMcpServer {
    const result: ToolMcpServer = {};

    if (server.command !== undefined) result.command = server.command;
    if (server.args !== undefined) result.args = server.args;
    if (server.url !== undefined) result.url = server.url;
    if (server.headers !== undefined) result.headers = server.headers;

    if (server.env && Object.keys(server.env).length > 0) {
      const { env } = transformEnvVars(server.env, syntax);
      result.env = env;
    }

    return result;
  }

  /**
   * Common validation logic shared across adapters.
   * Checks required fields for each config type.
   */
  protected validateCommon(type: ConfigType, file: unknown): ValidationResult {
    const errors: string[] = [];

    if (typeof file !== "object" || file === null) {
      errors.push(`${type} must be a valid object`);
      return { valid: false, errors };
    }

    // Safe to access properties via record after object check
    const record = file as Record<string, unknown>;

    switch (type) {
      case "skills": {
        if (!record.name) errors.push("Skill must have a name");
        if (!record.skillFile) errors.push("Skill must have a SKILL.md file");
        break;
      }

      case "rules": {
        if (!record.name) errors.push("Rule must have a name");
        if (!record.content) errors.push("Rule must have content");
        break;
      }

      case "agents": {
        if (!record.name) errors.push("Agent must have a name");
        const fm = record.frontmatter as Record<string, unknown> | undefined;
        if (!fm?.name) errors.push("Agent must have frontmatter with name field");
        break;
      }

      case "memory": {
        if (!record.filename) errors.push("Memory file must have a filename");
        if (!record.content) errors.push("Memory file must have content");
        break;
      }

      case "commands": {
        if (!record.name) errors.push("Command must have a name");
        if (!record.content) errors.push("Command must have content");
        break;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
