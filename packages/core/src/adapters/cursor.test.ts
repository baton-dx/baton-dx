import { beforeEach, describe, expect, it } from "vitest";
import { CursorAdapter } from "./cursor.js";
import type { AgentFile, CommandFile, MemoryFile, RuleFile, SkillDir } from "./types.js";

describe("CursorAdapter", () => {
    let adapter: CursorAdapter;

    beforeEach(() => {
        adapter = new CursorAdapter();
    });

    describe("metadata", () => {
        it("should have correct key and name", () => {
            expect(adapter.key).toBe("cursor");
            expect(adapter.name).toBe("Cursor");
        });
    });

    describe("getPath", () => {
        it("should return correct project paths", () => {
            expect(adapter.getPath("skills", "project", "code-review")).toContain(
                ".cursor/skills/code-review",
            );
            expect(adapter.getPath("rules", "project", "typescript")).toContain(
                ".cursor/rules/typescript.mdc",
            );
            expect(adapter.getPath("agents", "project", "helper")).toContain(
                ".cursor/agents/helper.md",
            );
            expect(adapter.getPath("memory", "project", "AGENTS.md")).toContain("AGENTS.md");
            expect(adapter.getPath("commands", "project", "review")).toContain(
                ".cursor/commands/review.md",
            );
        });

        it("should return correct global paths", () => {
            expect(adapter.getPath("skills", "global", "code-review")).toContain(
                "/.cursor/skills/code-review",
            );
            expect(adapter.getPath("rules", "global", "typescript")).toContain(
                "/.cursor/rules/typescript.mdc",
            );
            expect(adapter.getPath("memory", "global", "AGENTS.md")).toContain(
                "/.cursor/AGENTS.md",
            );
        });
    });

    describe("getLegacyPaths", () => {
        it("should return .cursorrules for rules", () => {
            expect(adapter.getLegacyPaths("rules")).toEqual([".cursorrules"]);
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
        it("should convert universal rule to .mdc format with alwaysApply", () => {
            const rule: RuleFile = {
                name: "typescript-standards",
                content: "Use TypeScript strict mode\n\nAlways enable strict type checking.",
                frontmatter: {
                    description: "TypeScript coding standards",
                },
            };

            const transformed = adapter.transformRule(rule);

            expect(transformed.name).toBe("typescript-standards");
            expect(transformed.content).toContain('description: "TypeScript coding standards"');
            expect(transformed.content).toContain("alwaysApply: true");
            expect(transformed.content).toContain("Use TypeScript strict mode");
            expect(transformed.frontmatter).toEqual({
                description: "TypeScript coding standards",
                alwaysApply: true,
            });
        });

        it("should convert rule with paths to globs", () => {
            const rule: RuleFile = {
                name: "react-rules",
                content: "Use functional components\n\nAlways prefer hooks.",
                frontmatter: {
                    description: "React best practices",
                    paths: ["**/*.tsx", "**/*.jsx"],
                },
            };

            const transformed = adapter.transformRule(rule);

            expect(transformed.content).toContain('description: "React best practices"');
            expect(transformed.content).toContain("globs:");
            expect(transformed.content).toContain('"**/*.tsx"');
            expect(transformed.content).toContain('"**/*.jsx"');
            expect(transformed.content).not.toContain("alwaysApply");
            expect(transformed.frontmatter).toEqual({
                description: "React best practices",
                globs: ["**/*.tsx", "**/*.jsx"],
            });
        });

        it("should extract description from content if not in frontmatter", () => {
            const rule: RuleFile = {
                name: "simple-rule",
                content: "# TypeScript Rules\n\nAlways use strict mode.",
                frontmatter: {},
            };

            const transformed = adapter.transformRule(rule);

            expect(transformed.frontmatter?.description).toBe("Always use strict mode.");
        });

        it("should strip existing frontmatter from content", () => {
            const rule: RuleFile = {
                name: "with-frontmatter",
                content:
                    '---\ndescription: Old description\npaths: ["*.ts"]\n---\n\nRule content here',
                frontmatter: {
                    description: "Old description",
                    paths: ["*.ts"],
                },
            };

            const transformed = adapter.transformRule(rule);

            expect(transformed.content).toContain("Rule content here");
            // New .mdc frontmatter should be present with description
            expect(transformed.content).toContain('description: "Old description"');
            expect(transformed.content).toContain("globs:");
            expect(transformed.content).toContain('"*.ts"');
            // Ensure old frontmatter syntax (paths:) is not present in body
            const bodyAfterFrontmatter = transformed.content.split("---")[2];
            expect(bodyAfterFrontmatter).not.toContain("paths:");
        });

        it("should handle rule with no description", () => {
            const rule: RuleFile = {
                name: "no-desc",
                content: "",
                frontmatter: {},
            };

            const transformed = adapter.transformRule(rule);

            expect(transformed.frontmatter?.description).toBe("Rule");
        });
    });

    describe("transformAgent", () => {
        it("should return agent unchanged", () => {
            const agent: AgentFile = {
                name: "helper",
                content: "Agent content",
                frontmatter: {
                    name: "Helper Agent",
                    description: "Helps with tasks",
                },
            };

            const transformed = adapter.transformAgent(agent);
            expect(transformed).toEqual(agent);
            expect(transformed).toBe(agent);
        });
    });

    describe("transformMemory", () => {
        it("should convert MEMORY.md to AGENTS.md", () => {
            const memory: MemoryFile = {
                filename: "MEMORY.md",
                content: "Memory content",
            };

            const transformed = adapter.transformMemory(memory);

            expect(transformed.filename).toBe("AGENTS.md");
            expect(transformed.content).toBe("Memory content");
        });

        it("should keep explicit filenames unchanged", () => {
            const memory: MemoryFile = {
                filename: "CLAUDE.md",
                content: "Memory content",
            };

            const transformed = adapter.transformMemory(memory);

            expect(transformed.filename).toBe("CLAUDE.md");
            expect(transformed.content).toBe("Memory content");
        });
    });

    describe("transformCommand", () => {
        it("should return command unchanged", () => {
            const command: CommandFile = {
                name: "review",
                content: "Review command",
            };

            const transformed = adapter.transformCommand(command);
            expect(transformed).toEqual(command);
            expect(transformed).toBe(command);
        });
    });

    describe("validate", () => {
        it("should validate skill correctly", () => {
            const validSkill: SkillDir = {
                name: "test-skill",
                skillFile: "/path/to/SKILL.md",
                files: ["/path/to/SKILL.md"],
            };
            const result = adapter.validate("skills", validSkill);
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);

            const invalidSkill = { skillFile: "/path/to/SKILL.md", files: [] };
            const invalidResult = adapter.validate("skills", invalidSkill);
            expect(invalidResult.valid).toBe(false);
            expect(invalidResult.errors).toContain("Skill must have a name");
        });

        it("should validate rule correctly", () => {
            const validRule: RuleFile = {
                name: "test-rule",
                content: "test content",
                frontmatter: { description: "Test rule" },
            };
            const result = adapter.validate("rules", validRule);
            expect(result.valid).toBe(true);

            const invalidRule = { name: "test" };
            const invalidResult = adapter.validate("rules", invalidRule);
            expect(invalidResult.valid).toBe(false);
            expect(invalidResult.errors).toContain("Rule must have content");
        });

        it("should validate rule requires description in frontmatter", () => {
            const ruleWithoutDesc: RuleFile = {
                name: "test-rule",
                content: "test content",
                frontmatter: {},
            };
            const result = adapter.validate("rules", ruleWithoutDesc);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain("Cursor rule must have a description in frontmatter");
        });

        it("should validate memory filename is AGENTS.md", () => {
            const validMemory: MemoryFile = {
                filename: "AGENTS.md",
                content: "test content",
            };
            const result = adapter.validate("memory", validMemory);
            expect(result.valid).toBe(true);

            const invalidMemory: MemoryFile = {
                filename: "CLAUDE.md",
                content: "test content",
            };
            const invalidResult = adapter.validate("memory", invalidMemory);
            expect(invalidResult.valid).toBe(false);
            expect(invalidResult.errors).toContain("Cursor memory file should be AGENTS.md");
        });

        it("should validate agent correctly", () => {
            const validAgent: AgentFile = {
                name: "test-agent",
                content: "test",
                frontmatter: {
                    name: "Test Agent",
                },
            };
            const result = adapter.validate("agents", validAgent);
            expect(result.valid).toBe(true);
        });

        it("should validate command correctly", () => {
            const validCommand: CommandFile = {
                name: "test-command",
                content: "test",
            };
            const result = adapter.validate("commands", validCommand);
            expect(result.valid).toBe(true);
        });
    });
});
