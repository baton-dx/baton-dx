import { beforeEach, describe, expect, it } from "vitest";
import type { AgentFile, CommandFile, MemoryFile, RuleFile, SkillDir } from "./types.js";
import { WindsurfAdapter } from "./windsurf.js";

describe("WindsurfAdapter", () => {
  let adapter: WindsurfAdapter;

  beforeEach(() => {
    adapter = new WindsurfAdapter();
  });

  describe("metadata", () => {
    it("should have correct key and name", () => {
      expect(adapter.key).toBe("windsurf");
      expect(adapter.name).toBe("Windsurf");
    });
  });

  describe("getPath", () => {
    it("should return correct project paths", () => {
      expect(adapter.getPath("skills", "project", "code-review")).toContain(
        ".windsurf/skills/code-review",
      );
      expect(adapter.getPath("rules", "project", "typescript")).toContain(
        ".windsurf/rules/typescript.md",
      );
      expect(adapter.getPath("agents", "project", "helper")).toContain(
        ".windsurf/agents/helper.md",
      );
      expect(adapter.getPath("memory", "project", "AGENTS.md")).toContain("AGENTS.md");
      expect(adapter.getPath("commands", "project", "review")).toContain(
        ".windsurf/workflows/review.md",
      );
    });

    it("should return correct global paths", () => {
      expect(adapter.getPath("skills", "global", "code-review")).toContain(
        "/.codeium/windsurf/skills/code-review",
      );
      expect(adapter.getPath("rules", "global", "typescript")).toContain(
        "/.codeium/windsurf/rules/typescript.md",
      );
      expect(adapter.getPath("memory", "global", "AGENTS.md")).toContain(
        "/.codeium/windsurf/AGENTS.md",
      );
    });
  });

  describe("getLegacyPaths", () => {
    it("should return .windsurfrules for rules", () => {
      expect(adapter.getLegacyPaths("rules")).toEqual([".windsurfrules"]);
    });

    it("should return empty array for other types", () => {
      expect(adapter.getLegacyPaths("skills")).toEqual([]);
      expect(adapter.getLegacyPaths("agents")).toEqual([]);
      expect(adapter.getLegacyPaths("memory")).toEqual([]);
      expect(adapter.getLegacyPaths("commands")).toEqual([]);
    });
  });

  describe("transformSkill", () => {
    it("should return skill unchanged (1:1 copy)", () => {
      const skill: SkillDir = {
        name: "code-review",
        skillFile: "/path/to/SKILL.md",
        files: ["/path/to/SKILL.md", "/path/to/scripts/run.sh"],
      };

      const transformed = adapter.transformSkill(skill);
      expect(transformed).toEqual(skill);
      expect(transformed).toBe(skill); // Same reference
    });
  });

  describe("transformRule", () => {
    it("should strip YAML frontmatter from rule content", () => {
      const rule: RuleFile = {
        name: "typescript-standards",
        content: `---
description: TypeScript coding standards
paths:
  - "src/**/*.ts"
  - "src/**/*.tsx"
---
Use TypeScript strict mode

Always enable strict type checking.`,
        frontmatter: {
          description: "TypeScript coding standards",
          paths: ["src/**/*.ts", "src/**/*.tsx"],
        },
      };

      const transformed = adapter.transformRule(rule);

      expect(transformed.name).toBe("typescript-standards");
      // Should NOT contain frontmatter
      expect(transformed.content).not.toContain("---");
      expect(transformed.content).not.toContain("description:");
      expect(transformed.content).not.toContain("paths:");
      // Should contain only the content
      expect(transformed.content).toContain("Use TypeScript strict mode");
      expect(transformed.content).toContain("Always enable strict type checking.");
      // No frontmatter in transformed rule
      expect(transformed.frontmatter).toBeUndefined();
    });

    it("should handle rule without frontmatter", () => {
      const rule: RuleFile = {
        name: "simple-rule",
        content: "Use functional components\n\nAlways prefer hooks.",
        frontmatter: undefined,
      };

      const transformed = adapter.transformRule(rule);

      expect(transformed.name).toBe("simple-rule");
      expect(transformed.content).toBe("Use functional components\n\nAlways prefer hooks.");
      expect(transformed.frontmatter).toBeUndefined();
    });

    it("should strip frontmatter with multiple fields", () => {
      const rule: RuleFile = {
        name: "react-rules",
        content: `---
description: React best practices
paths:
  - "src/components/**/*.tsx"
priority: high
enabled: true
---
# React Component Guidelines

Use functional components with hooks.

## Props
- Always define prop types
- Use TypeScript interfaces`,
        frontmatter: {
          description: "React best practices",
          paths: ["src/components/**/*.tsx"],
          priority: "high",
          enabled: true,
        },
      };

      const transformed = adapter.transformRule(rule);

      expect(transformed.name).toBe("react-rules");
      // Should NOT contain any frontmatter fields
      expect(transformed.content).not.toContain("---");
      expect(transformed.content).not.toContain("description:");
      expect(transformed.content).not.toContain("priority:");
      expect(transformed.content).not.toContain("enabled:");
      // Should contain content
      expect(transformed.content).toContain("# React Component Guidelines");
      expect(transformed.content).toContain("Use functional components with hooks.");
      expect(transformed.content).toContain("Always define prop types");
      expect(transformed.frontmatter).toBeUndefined();
    });

    it("should handle rule with only opening frontmatter delimiter", () => {
      const rule: RuleFile = {
        name: "malformed-rule",
        content: `---
description: Incomplete frontmatter
This is content without closing delimiter`,
      };

      const transformed = adapter.transformRule(rule);

      expect(transformed.name).toBe("malformed-rule");
      // Content should be returned as-is when malformed
      expect(transformed.content).toContain("---");
      expect(transformed.content).toContain("description: Incomplete frontmatter");
      expect(transformed.frontmatter).toBeUndefined();
    });
  });

  describe("transformAgent", () => {
    it("should return agent unchanged", () => {
      const agent: AgentFile = {
        name: "helper",
        description: "Helper agent",
        content: "Agent content",
        frontmatter: {
          name: "helper",
          description: "Helper agent",
          tools: ["bash", "edit"],
        },
      };

      const transformed = adapter.transformAgent(agent);
      expect(transformed).toEqual(agent);
      expect(transformed).toBe(agent); // Same reference
    });
  });

  describe("transformMemory", () => {
    it("should convert MEMORY.md to AGENTS.md", () => {
      const memory: MemoryFile = {
        filename: "MEMORY.md",
        content: "# Project Context\n\nThis is a TypeScript project.",
      };

      const transformed = adapter.transformMemory(memory);

      expect(transformed.filename).toBe("AGENTS.md");
      expect(transformed.content).toBe(memory.content);
    });

    it("should keep explicit filenames unchanged", () => {
      const memory: MemoryFile = {
        filename: "CLAUDE.md",
        content: "# Project Context",
      };

      const transformed = adapter.transformMemory(memory);

      expect(transformed.filename).toBe("CLAUDE.md");
      expect(transformed.content).toBe(memory.content);
    });

    it("should keep AGENTS.md filename unchanged", () => {
      const memory: MemoryFile = {
        filename: "AGENTS.md",
        content: "# Project Context",
      };

      const transformed = adapter.transformMemory(memory);

      expect(transformed.filename).toBe("AGENTS.md");
      expect(transformed.content).toBe(memory.content);
    });
  });

  describe("transformCommand", () => {
    it("should return command unchanged", () => {
      const command: CommandFile = {
        name: "review",
        content: "Review the code",
      };

      const transformed = adapter.transformCommand(command);
      expect(transformed).toEqual(command);
      expect(transformed).toBe(command); // Same reference
    });
  });

  describe("validate", () => {
    it("should validate skills", () => {
      const validSkill: SkillDir = {
        name: "code-review",
        skillFile: "/path/to/SKILL.md",
        files: ["/path/to/SKILL.md"],
      };

      const result = adapter.validate("skills", validSkill);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should reject skill without name", () => {
      const invalidSkill: SkillDir = {
        name: "",
        skillFile: "/path/to/SKILL.md",
        files: [],
      };

      const result = adapter.validate("skills", invalidSkill);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Skill must have a name");
    });

    it("should validate rules without frontmatter", () => {
      const validRule: RuleFile = {
        name: "typescript",
        content: "Use TypeScript strict mode",
        frontmatter: undefined,
      };

      const result = adapter.validate("rules", validRule);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should reject rule with frontmatter", () => {
      const invalidRule: RuleFile = {
        name: "typescript",
        content: "Use TypeScript strict mode",
        frontmatter: {
          description: "TypeScript standards",
        },
      };

      const result = adapter.validate("rules", invalidRule);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Windsurf rules should not have YAML frontmatter");
    });

    it("should validate memory with AGENTS.md filename", () => {
      const validMemory: MemoryFile = {
        filename: "AGENTS.md",
        content: "Project context",
      };

      const result = adapter.validate("memory", validMemory);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should reject memory with wrong filename", () => {
      const invalidMemory: MemoryFile = {
        filename: "CLAUDE.md",
        content: "Project context",
      };

      const result = adapter.validate("memory", invalidMemory);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Windsurf memory file should be AGENTS.md");
    });

    it("should validate commands", () => {
      const validCommand: CommandFile = {
        name: "review",
        content: "Review code",
      };

      const result = adapter.validate("commands", validCommand);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });
});
