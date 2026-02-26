import type { ConfigType } from "@baton-dx/ai-tool-paths";
import { parseFrontmatter } from "../utils/frontmatter.js";
import { BaseAIToolAdapter } from "./base-adapter.js";
import type { McpCapabilities, RuleFile, ValidationResult } from "./types.js";

/**
 * Cursor adapter — transforms rules to .mdc format.
 *
 * Overrides:
 * - getLegacyPaths(): .cursorrules
 * - transformRule(): converts to .mdc with description, globs, alwaysApply
 * - validate(): adds Cursor-specific rules + memory checks
 */
export class CursorAdapter extends BaseAIToolAdapter {
  readonly key = "cursor";
  readonly name = "Cursor";

  override readonly mcpCapabilities: McpCapabilities = {
    supported: true,
    configKey: "mcpServers",
    envVarSyntax: "dollar-brace",
    format: "json",
    sharedSettingsFile: false,
    supportedScopes: ["project", "global"],
  };

  override getLegacyPaths(type: ConfigType): string[] {
    if (type === "rules") {
      return [".cursorrules"];
    }
    return [];
  }

  override transformRule(rule: RuleFile): RuleFile {
    const { name, content, frontmatter } = rule;

    const description = frontmatter?.description || this.extractDescription(content);
    const paths = frontmatter?.paths as string[] | undefined;

    const mdcFrontmatter: Record<string, unknown> = { description };

    if (paths && paths.length > 0) {
      mdcFrontmatter.globs = paths;
    }

    if (!paths || paths.length === 0) {
      mdcFrontmatter.alwaysApply = true;
    }

    const strippedContent = parseFrontmatter(content).content;
    const frontmatterYaml = this.buildFrontmatter(mdcFrontmatter);

    return {
      name,
      content: `${frontmatterYaml}\n${strippedContent}`,
      frontmatter: mdcFrontmatter,
    };
  }

  override validate(type: ConfigType, file: unknown): ValidationResult {
    const result = this.validateCommon(type, file);

    if (type === "rules") {
      const rule = file as RuleFile;
      if (rule.frontmatter && !rule.frontmatter.description) {
        result.errors.push("Cursor rule must have a description in frontmatter");
        result.valid = false;
      }
    }

    if (type === "memory") {
      const memory = file as { filename?: string };
      if (memory.filename && memory.filename !== "AGENTS.md") {
        result.errors.push("Cursor memory file should be AGENTS.md");
        result.valid = false;
      }
    }

    return result;
  }

  private extractDescription(content: string): string {
    const stripped = parseFrontmatter(content).content;
    const lines = stripped.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        return trimmed;
      }
    }
    return "Rule";
  }

  private buildFrontmatter(obj: Record<string, unknown>): string {
    const lines = ["---"];

    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - "${item}"`);
        }
      } else if (typeof value === "string") {
        lines.push(`${key}: "${value}"`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    }

    lines.push("---");
    return lines.join("\n");
  }
}
