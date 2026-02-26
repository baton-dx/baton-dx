import type { ConfigType } from "@baton-dx/ai-tool-paths";
import { parseFrontmatter } from "../utils/frontmatter.js";
import { BaseAIToolAdapter } from "./base-adapter.js";
import type { McpCapabilities, RuleFile, ValidationResult } from "./types.js";

/**
 * Windsurf adapter — strips YAML frontmatter from rules.
 *
 * Overrides:
 * - getLegacyPaths(): .windsurfrules
 * - transformRule(): removes all YAML frontmatter
 * - validate(): adds Windsurf-specific rules + memory checks
 */
export class WindsurfAdapter extends BaseAIToolAdapter {
  readonly key = "windsurf";
  readonly name = "Windsurf";

  override readonly mcpCapabilities: McpCapabilities = {
    supported: true,
    configKey: "mcpServers",
    envVarSyntax: "dollar-env-colon",
    format: "json",
    sharedSettingsFile: false,
    supportedScopes: ["global"],
  };

  override getLegacyPaths(type: ConfigType): string[] {
    if (type === "rules") {
      return [".windsurfrules"];
    }
    return [];
  }

  override transformRule(rule: RuleFile): RuleFile {
    const { name, content } = rule;
    const strippedContent = parseFrontmatter(content).content.trim();

    return {
      name,
      content: strippedContent,
      frontmatter: undefined,
    };
  }

  override validate(type: ConfigType, file: unknown): ValidationResult {
    const result = this.validateCommon(type, file);

    if (type === "rules") {
      const rule = file as RuleFile;
      if (rule.frontmatter) {
        result.errors.push("Windsurf rules should not have YAML frontmatter");
        result.valid = false;
      }
    }

    if (type === "memory") {
      const memory = file as { filename?: string };
      if (memory.filename && memory.filename !== "AGENTS.md") {
        result.errors.push("Windsurf memory file should be AGENTS.md");
        result.valid = false;
      }
    }

    return result;
  }
}
