import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { clearAIToolCache, setDetectedAITools } from "../detection/ai-tool-detection.js";
import { ClaudeCodeAdapter } from "./claude-code.js";
import type { AgentFile, CommandFile, MemoryFile, RuleFile, SkillDir } from "./types.js";

describe("ClaudeCodeAdapter", () => {
    let adapter: ClaudeCodeAdapter;

    beforeEach(() => {
        adapter = new ClaudeCodeAdapter();
        clearAIToolCache();
    });

    afterEach(() => {
        clearAIToolCache();
    });

    describe("metadata", () => {
        test("should have correct key and name", () => {
            expect(adapter.key).toBe("claude-code");
            expect(adapter.name).toBe("Claude Code");
        });
    });

    describe("isInstalled", () => {
        test("should return true when claude-code is detected", async () => {
            setDetectedAITools(["claude-code"]);
            const result = await adapter.isInstalled();
            expect(result).toBe(true);
        });

        test("should return false when claude-code is not detected", async () => {
            setDetectedAITools([]);
            const result = await adapter.isInstalled();
            expect(result).toBe(false);
        });
    });

    describe("getPath", () => {
        test("should return correct project path for skills", () => {
            const path = adapter.getPath("skills", "project", "code-review");
            expect(path).toContain(".claude/skills/code-review");
        });

        test("should return correct global path for skills", () => {
            const path = adapter.getPath("skills", "global", "code-review");
            expect(path).toContain(".claude/skills/code-review");
        });

        test("should return correct project path for rules", () => {
            const path = adapter.getPath("rules", "project", "coding-standards");
            expect(path).toBe(".claude/rules/coding-standards.md");
        });

        test("should return correct path for agents", () => {
            const path = adapter.getPath("agents", "project", "reviewer");
            expect(path).toBe(".claude/agents/reviewer.md");
        });

        test("should return correct path for memory", () => {
            const path = adapter.getPath("memory", "project", "CLAUDE");
            expect(path).toBe("CLAUDE.md");
        });

        test("should return correct path for commands", () => {
            const path = adapter.getPath("commands", "project", "review");
            expect(path).toBe(".claude/commands/review.md");
        });
    });

    describe("getLegacyPaths", () => {
        test("should return empty array for all types", () => {
            expect(adapter.getLegacyPaths("skills")).toEqual([]);
            expect(adapter.getLegacyPaths("rules")).toEqual([]);
            expect(adapter.getLegacyPaths("agents")).toEqual([]);
            expect(adapter.getLegacyPaths("memory")).toEqual([]);
            expect(adapter.getLegacyPaths("commands")).toEqual([]);
        });
    });

    describe("transformSkill", () => {
        test("should return skill unchanged (1:1 copy)", () => {
            const skill: SkillDir = {
                name: "code-review",
                skillFile: "/path/to/SKILL.md",
                files: ["/path/to/SKILL.md"],
            };

            const result = adapter.transformSkill(skill);
            expect(result).toBe(skill);
        });
    });

    describe("transformRule", () => {
        test("should return rule unchanged", () => {
            const rule: RuleFile = {
                name: "coding-standards",
                content: "# Coding Standards\n\nFollow these rules...",
                frontmatter: {
                    paths: ["src/**/*.ts"],
                },
            };

            const result = adapter.transformRule(rule);
            expect(result).toBe(rule);
        });
    });

    describe("transformAgent", () => {
        test("should return agent unchanged", () => {
            const agent: AgentFile = {
                name: "reviewer",
                description: "Code review agent",
                content: "# Reviewer\n\nReview code for quality...",
                frontmatter: {
                    name: "reviewer",
                    description: "Code review agent",
                    tools: ["bash", "grep"],
                    model: "claude-opus-4-6",
                },
            };

            const result = adapter.transformAgent(agent);
            expect(result).toBe(agent);
        });
    });

    describe("transformMemory", () => {
        test("should return memory unchanged", () => {
            const memory: MemoryFile = {
                filename: "CLAUDE.md",
                content: "# Project Context\n\nThis project uses...",
            };

            const result = adapter.transformMemory(memory);
            expect(result).toBe(memory);
        });
    });

    describe("transformCommand", () => {
        test("should return command unchanged", () => {
            const command: CommandFile = {
                name: "review",
                content: "# Review Command\n\nReview the current PR...",
            };

            const result = adapter.transformCommand(command);
            expect(result).toBe(command);
        });
    });

    describe("validate", () => {
        test("should validate skill with name and skillFile", () => {
            const skill: SkillDir = {
                name: "code-review",
                skillFile: "/path/to/SKILL.md",
                files: ["/path/to/SKILL.md"],
            };

            const result = adapter.validate("skills", skill);
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        test("should reject skill without name", () => {
            const skill = {
                skillFile: "/path/to/SKILL.md",
                files: ["/path/to/SKILL.md"],
            };

            const result = adapter.validate("skills", skill);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain("Skill must have a name");
        });

        test("should reject skill without skillFile", () => {
            const skill = {
                name: "code-review",
                files: [],
            };

            const result = adapter.validate("skills", skill);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain("Skill must have a SKILL.md file");
        });

        test("should validate rule with name and content", () => {
            const rule: RuleFile = {
                name: "coding-standards",
                content: "# Standards\n\nFollow these...",
            };

            const result = adapter.validate("rules", rule);
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        test("should reject rule without content", () => {
            const rule = {
                name: "coding-standards",
            };

            const result = adapter.validate("rules", rule);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain("Rule must have content");
        });

        test("should validate agent with name and frontmatter.name", () => {
            const agent: AgentFile = {
                name: "reviewer",
                content: "# Reviewer\n\nReview code...",
                frontmatter: {
                    name: "reviewer",
                    description: "Code review agent",
                },
            };

            const result = adapter.validate("agents", agent);
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        test("should reject agent without frontmatter.name", () => {
            const agent = {
                name: "reviewer",
                content: "# Reviewer",
                frontmatter: {},
            };

            const result = adapter.validate("agents", agent);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain("Agent must have frontmatter with name field");
        });

        test("should validate memory with filename and content", () => {
            const memory: MemoryFile = {
                filename: "CLAUDE.md",
                content: "# Context\n\nProject info...",
            };

            const result = adapter.validate("memory", memory);
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        test("should reject memory without filename", () => {
            const memory = {
                content: "# Context",
            };

            const result = adapter.validate("memory", memory);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain("Memory file must have a filename");
        });

        test("should validate command with name and content", () => {
            const command: CommandFile = {
                name: "review",
                content: "# Review\n\nReview PR...",
            };

            const result = adapter.validate("commands", command);
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        test("should reject command without name", () => {
            const command = {
                content: "# Review",
            };

            const result = adapter.validate("commands", command);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain("Command must have a name");
        });
    });
});
