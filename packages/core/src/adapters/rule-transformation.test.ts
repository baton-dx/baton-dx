import { describe, expect, it } from "vitest";
import { ClaudeCodeAdapter } from "./claude-code.js";
import { CursorAdapter } from "./cursor.js";
import type { RuleFile } from "./types.js";
import { WindsurfAdapter } from "./windsurf.js";

describe("Rule Transformation Tests", () => {
  describe("Universal Rule → Claude .md (no transformation)", () => {
    it("outputs rule as-is with YAML frontmatter preserved", () => {
      const claudeAdapter = new ClaudeCodeAdapter();

      const rule: RuleFile = {
        name: "coding-standards",
        content: "# Coding Standards\n\nFollow these guidelines...",
        frontmatter: {
          name: "coding-standards",
          paths: ["**/*.ts", "**/*.tsx"],
        },
      };

      const result = claudeAdapter.transformRule(rule);

      expect(result.name).toBe("coding-standards");
      expect(result.content).toBe(rule.content);
      expect(result.frontmatter).toEqual(rule.frontmatter);
    });

    it("preserves universal rules without paths", () => {
      const claudeAdapter = new ClaudeCodeAdapter();

      const rule: RuleFile = {
        name: "universal",
        content: "# Universal Rule\n\nAlways applicable",
        frontmatter: {
          name: "universal",
        },
      };

      const result = claudeAdapter.transformRule(rule);

      expect(result.frontmatter?.paths).toBeUndefined();
      expect(result.content).toContain("Always applicable");
    });
  });

  describe("Universal Rule → Cursor .mdc format", () => {
    it("converts rule to .mdc format with globs and alwaysApply", () => {
      const cursorAdapter = new CursorAdapter();

      const rule: RuleFile = {
        name: "coding-standards",
        content: "# Coding Standards\n\nFollow these guidelines...",
        frontmatter: {
          name: "coding-standards",
          paths: ["**/*.ts", "**/*.tsx"],
        },
      };

      const result = cursorAdapter.transformRule(rule);

      expect(result.name).toBe("coding-standards");
      expect(result.frontmatter?.globs).toEqual(["**/*.ts", "**/*.tsx"]);
      expect(result.frontmatter?.paths).toBeUndefined(); // Converted to globs
      expect(result.content).toContain("Coding Standards");
    });

    it("adds alwaysApply: true for universal rules (no paths)", () => {
      const cursorAdapter = new CursorAdapter();

      const rule: RuleFile = {
        name: "universal",
        content: "# Universal Rule\n\nAlways applicable",
        frontmatter: {
          name: "universal",
        },
      };

      const result = cursorAdapter.transformRule(rule);

      expect(result.frontmatter?.alwaysApply).toBe(true);
      expect(result.frontmatter?.globs).toBeUndefined();
    });

    it("extracts description from frontmatter", () => {
      const cursorAdapter = new CursorAdapter();

      const rule: RuleFile = {
        name: "test",
        content: "Rule content",
        frontmatter: {
          name: "test",
          description: "Test rule description",
          paths: ["**/*.ts"],
        },
      };

      const result = cursorAdapter.transformRule(rule);

      expect(result.frontmatter?.description).toBe("Test rule description");
    });

    it("extracts description from first paragraph if not in frontmatter", () => {
      const cursorAdapter = new CursorAdapter();

      const rule: RuleFile = {
        name: "test",
        content: "This is the first paragraph with description.\n\nSecond paragraph.",
        frontmatter: {
          name: "test",
          paths: ["**/*.ts"],
        },
      };

      const result = cursorAdapter.transformRule(rule);

      expect(result.frontmatter?.description).toContain("first paragraph");
    });

    it("strips existing YAML frontmatter and rebuilds in .mdc format", () => {
      const cursorAdapter = new CursorAdapter();

      const rule: RuleFile = {
        name: "test",
        content: "---\nname: test\npaths:\n  - '**/*.ts'\n---\n# Test\n\nContent",
        frontmatter: {
          name: "test",
          paths: ["**/*.ts"],
        },
      };

      const result = cursorAdapter.transformRule(rule);

      // Content stripped of original frontmatter has new frontmatter
      const lines = result.content.split("\n");
      expect(lines[0]).toBe("---"); // New frontmatter starts
      expect(result.content).toContain("# Test");

      // Frontmatter rebuilt with globs
      expect(result.frontmatter?.globs).toEqual(["**/*.ts"]);
    });
  });

  describe("Universal Rule → Windsurf .md (strips frontmatter)", () => {
    it("strips all YAML frontmatter from rule", () => {
      const windsurfAdapter = new WindsurfAdapter();

      const rule: RuleFile = {
        name: "coding-standards",
        content:
          "---\nname: coding-standards\npaths:\n  - '**/*.ts'\n---\n# Coding Standards\n\nFollow these guidelines...",
        frontmatter: {
          name: "coding-standards",
          paths: ["**/*.ts"],
        },
      };

      const result = windsurfAdapter.transformRule(rule);

      expect(result.content).not.toContain("---");
      expect(result.content).not.toContain("name: coding-standards");
      expect(result.content).toContain("# Coding Standards");
      expect(result.frontmatter).toBeUndefined();
    });

    it("handles rule without frontmatter (no change)", () => {
      const windsurfAdapter = new WindsurfAdapter();

      const rule: RuleFile = {
        name: "simple",
        content: "# Simple Rule\n\nNo frontmatter here.",
      };

      const result = windsurfAdapter.transformRule(rule);

      expect(result.content).toBe(rule.content);
      expect(result.frontmatter).toBeUndefined();
    });

    it("handles malformed frontmatter (only opening delimiter)", () => {
      const windsurfAdapter = new WindsurfAdapter();

      const rule: RuleFile = {
        name: "malformed",
        content: "---\nname: test\n# No closing delimiter\n\nContent",
      };

      const result = windsurfAdapter.transformRule(rule);

      // Returns as-is when malformed
      expect(result.content).toBe(rule.content);
    });

    it("strips frontmatter and preserves multiple sections", () => {
      const windsurfAdapter = new WindsurfAdapter();

      const rule: RuleFile = {
        name: "multi-section",
        content: "---\nname: test\n---\n# Section 1\n\nContent 1\n\n## Section 2\n\nContent 2",
        frontmatter: {
          name: "test",
        },
      };

      const result = windsurfAdapter.transformRule(rule);

      expect(result.content).toContain("# Section 1");
      expect(result.content).toContain("## Section 2");
      expect(result.content).not.toContain("name: test");
    });
  });

  describe("Edge cases and validation", () => {
    it("handles empty rule content", () => {
      const claudeAdapter = new ClaudeCodeAdapter();

      const rule: RuleFile = {
        name: "empty",
        content: "",
      };

      const result = claudeAdapter.transformRule(rule);

      expect(result.content).toBe("");
    });

    it("handles rules with only frontmatter", () => {
      const cursorAdapter = new CursorAdapter();

      const rule: RuleFile = {
        name: "frontmatter-only",
        content: "",
        frontmatter: {
          name: "test",
          paths: ["**/*.ts"],
        },
      };

      const result = cursorAdapter.transformRule(rule);

      expect(result.frontmatter?.globs).toEqual(["**/*.ts"]);
    });

    it("handles rules with special characters in content", () => {
      const claudeAdapter = new ClaudeCodeAdapter();

      const rule: RuleFile = {
        name: "special",
        content: "Rule with `code`, **bold**, and [links](url)",
      };

      const result = claudeAdapter.transformRule(rule);

      expect(result.content).toContain("`code`");
      expect(result.content).toContain("**bold**");
      expect(result.content).toContain("[links](url)");
    });

    it("validates transformed rule structure", () => {
      const cursorAdapter = new CursorAdapter();

      const rule: RuleFile = {
        name: "test",
        content: "Content",
        frontmatter: {
          name: "test",
        },
      };

      const result = cursorAdapter.transformRule(rule);

      // Should have valid structure
      expect(result).toHaveProperty("name");
      expect(result).toHaveProperty("content");
      expect(typeof result.name).toBe("string");
      expect(typeof result.content).toBe("string");
    });
  });
});
