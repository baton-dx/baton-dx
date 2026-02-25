import type { ConfigType, Scope } from "@baton-dx/ai-tool-paths";
import { getAIToolPath } from "@baton-dx/ai-tool-paths";

import type {
  AgentFile,
  AIToolAdapter,
  CommandFile,
  MemoryFile,
  RuleFile,
  SkillDir,
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
