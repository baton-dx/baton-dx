import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { clearAIToolCache, setDetectedAITools } from "../detection/ai-tool-detection.js";
import { BaseAIToolAdapter } from "./base-adapter.js";
import type { AgentFile, CommandFile, MemoryFile, RuleFile, SkillDir } from "./types.js";

/** Concrete test subclass */
class TestAdapter extends BaseAIToolAdapter {
  readonly key = "test-tool";
  readonly name = "Test Tool";
}

class CustomMemoryAdapter extends BaseAIToolAdapter {
  readonly key = "custom";
  readonly name = "Custom";
  protected override memoryFilename = "CUSTOM.md";
}

describe("BaseAIToolAdapter", () => {
  let adapter: TestAdapter;

  beforeEach(() => {
    adapter = new TestAdapter();
    clearAIToolCache();
  });

  afterEach(() => {
    clearAIToolCache();
  });

  describe("metadata", () => {
    test("exposes key and name", () => {
      expect(adapter.key).toBe("test-tool");
      expect(adapter.name).toBe("Test Tool");
    });
  });

  describe("isInstalled", () => {
    test("returns true when tool is detected", async () => {
      setDetectedAITools(["test-tool"]);
      expect(await adapter.isInstalled()).toBe(true);
    });

    test("returns false when tool is not detected", async () => {
      setDetectedAITools([]);
      expect(await adapter.isInstalled()).toBe(false);
    });
  });

  describe("getLegacyPaths", () => {
    test("returns empty array by default", () => {
      expect(adapter.getLegacyPaths("rules")).toEqual([]);
      expect(adapter.getLegacyPaths("skills")).toEqual([]);
      expect(adapter.getLegacyPaths("memory")).toEqual([]);
    });
  });

  describe("transform passthrough", () => {
    test("transformSkill returns input unchanged", () => {
      const skill: SkillDir = { name: "s", skillFile: "f", files: ["f"] };
      expect(adapter.transformSkill(skill)).toBe(skill);
    });

    test("transformRule returns input unchanged", () => {
      const rule: RuleFile = { name: "r", content: "c" };
      expect(adapter.transformRule(rule)).toBe(rule);
    });

    test("transformAgent returns input unchanged", () => {
      const agent: AgentFile = {
        name: "a",
        content: "c",
        frontmatter: { name: "a" },
      };
      expect(adapter.transformAgent(agent)).toBe(agent);
    });

    test("transformCommand returns input unchanged", () => {
      const cmd: CommandFile = { name: "c", content: "c" };
      expect(adapter.transformCommand(cmd)).toBe(cmd);
    });
  });

  describe("transformMemory", () => {
    test("converts MEMORY.md to memoryFilename", () => {
      const memory: MemoryFile = { filename: "MEMORY.md", content: "test" };
      const result = adapter.transformMemory(memory);
      expect(result.filename).toBe("AGENTS.md");
      expect(result.content).toBe("test");
    });

    test("keeps explicit filenames unchanged", () => {
      const memory: MemoryFile = { filename: "CLAUDE.md", content: "test" };
      const result = adapter.transformMemory(memory);
      expect(result).toBe(memory);
    });

    test("uses custom memoryFilename when overridden", () => {
      const custom = new CustomMemoryAdapter();
      const memory: MemoryFile = { filename: "MEMORY.md", content: "test" };
      const result = custom.transformMemory(memory);
      expect(result.filename).toBe("CUSTOM.md");
    });
  });

  describe("validate", () => {
    test("validates skill with name and skillFile", () => {
      const skill: SkillDir = { name: "s", skillFile: "/SKILL.md", files: [] };
      expect(adapter.validate("skills", skill)).toEqual({ valid: true, errors: [] });
    });

    test("rejects skill without name", () => {
      const result = adapter.validate("skills", { skillFile: "f", files: [] });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Skill must have a name");
    });

    test("rejects skill without skillFile", () => {
      const result = adapter.validate("skills", { name: "s", files: [] });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Skill must have a SKILL.md file");
    });

    test("validates rule with name and content", () => {
      const rule: RuleFile = { name: "r", content: "c" };
      expect(adapter.validate("rules", rule)).toEqual({ valid: true, errors: [] });
    });

    test("rejects rule without content", () => {
      const result = adapter.validate("rules", { name: "r" });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Rule must have content");
    });

    test("validates agent with name and frontmatter.name", () => {
      const agent: AgentFile = {
        name: "a",
        content: "c",
        frontmatter: { name: "a" },
      };
      expect(adapter.validate("agents", agent)).toEqual({ valid: true, errors: [] });
    });

    test("rejects agent without frontmatter.name", () => {
      const result = adapter.validate("agents", {
        name: "a",
        content: "c",
        frontmatter: {},
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Agent must have frontmatter with name field");
    });

    test("validates memory with filename and content", () => {
      const memory: MemoryFile = { filename: "AGENTS.md", content: "c" };
      expect(adapter.validate("memory", memory)).toEqual({ valid: true, errors: [] });
    });

    test("rejects memory without filename", () => {
      const result = adapter.validate("memory", { content: "c" });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Memory file must have a filename");
    });

    test("validates command with name and content", () => {
      const cmd: CommandFile = { name: "c", content: "c" };
      expect(adapter.validate("commands", cmd)).toEqual({ valid: true, errors: [] });
    });

    test("rejects command without name", () => {
      const result = adapter.validate("commands", { content: "c" });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Command must have a name");
    });

    test("validates settings as JSON object", () => {
      expect(adapter.validate("settings", { a: 1 })).toEqual({ valid: true, errors: [] });
    });

    test("rejects settings if not object", () => {
      const result = adapter.validate("settings", "not an object");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Settings must be a valid JSON object");
    });
  });
});
