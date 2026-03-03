import { beforeEach, describe, expect, test } from "vitest";
import { AntigravityAdapter } from "./antigravity.js";
import type { AgentFile, CommandFile, MemoryFile, RuleFile, SkillDir } from "./types.js";

describe("AntigravityAdapter", () => {
    let adapter: AntigravityAdapter;

    beforeEach(() => {
        adapter = new AntigravityAdapter();
    });

    // --- Metadata Tests ---
    test("has correct metadata", () => {
        expect(adapter.key).toBe("antigravity");
        expect(adapter.name).toBe("Antigravity");
    });

    // --- Installation Tests ---
    test("isInstalled returns boolean", async () => {
        const result = await adapter.isInstalled();
        expect(typeof result).toBe("boolean");
    });

    // --- Path Tests ---
    test("getPath returns correct project path for skills", () => {
        const path = adapter.getPath("skills", "project", "test-skill");
        expect(path).toContain(".agent/skills/test-skill");
    });

    test("getPath returns correct global path for skills", () => {
        const path = adapter.getPath("skills", "global", "test-skill");
        expect(path).toContain(".gemini/antigravity/skills/test-skill");
        // Tilde is expanded to home directory by getAIToolPath
        expect(path).toMatch(/^\/.*\.gemini\/antigravity\/skills\/test-skill$/);
    });

    test("getPath returns correct path for rules", () => {
        const path = adapter.getPath("rules", "project", "test-rule");
        expect(path).toContain(".agent/rules/test-rule.md");
    });

    test("getPath returns correct path for memory", () => {
        const path = adapter.getPath("memory", "project", "GEMINI.md");
        expect(path).toBe("GEMINI.md");
    });

    test("getPath returns correct path for commands", () => {
        const path = adapter.getPath("commands", "project", "test-command");
        expect(path).toContain(".agent/workflows/test-command.md");
    });

    // --- Legacy Paths Tests ---
    test("getLegacyPaths returns empty array", () => {
        const paths = adapter.getLegacyPaths("rules");
        expect(paths).toEqual([]);
    });

    // --- Transform Tests ---
    test("transformSkill returns input unchanged (1:1 copy)", () => {
        const skill: SkillDir = {
            name: "test-skill",
            skillFile: "/path/to/SKILL.md",
            files: ["/path/to/SKILL.md"],
        };
        const result = adapter.transformSkill(skill);
        expect(result).toBe(skill);
        expect(result).toEqual(skill);
    });

    test("transformRule returns input unchanged (1:1 copy)", () => {
        const rule: RuleFile = {
            name: "coding-standards",
            content: "# Coding Standards\n\nUse TypeScript strict mode.",
        };
        const result = adapter.transformRule(rule);
        expect(result).toBe(rule);
        expect(result).toEqual(rule);
    });

    test("transformAgent returns input unchanged (1:1 copy)", () => {
        const agent: AgentFile = {
            name: "test-agent",
            content: "# Test Agent\n\nThis is a test agent.",
            frontmatter: {
                name: "test-agent",
                description: "A test agent",
            },
        };
        const result = adapter.transformAgent(agent);
        expect(result).toBe(agent);
        expect(result).toEqual(agent);
    });

    test("transformMemory converts MEMORY.md to GEMINI.md", () => {
        const memory: MemoryFile = {
            filename: "MEMORY.md",
            content: "# Project Context\n\nThis is project context.",
        };
        const result = adapter.transformMemory(memory);
        expect(result).not.toBe(memory); // New object created
        expect(result.filename).toBe("GEMINI.md");
        expect(result.content).toBe(memory.content);
    });

    test("transformMemory keeps explicit filenames unchanged", () => {
        const memory: MemoryFile = {
            filename: "CLAUDE.md",
            content: "# Project Context",
        };
        const result = adapter.transformMemory(memory);
        expect(result).toBe(memory); // Same object returned
        expect(result.filename).toBe("CLAUDE.md");
    });

    test("transformCommand returns input unchanged (1:1 copy)", () => {
        const command: CommandFile = {
            name: "review",
            content: "# Review Command\n\nRun code review.",
        };
        const result = adapter.transformCommand(command);
        expect(result).toBe(command);
        expect(result).toEqual(command);
    });

    // --- Validation Tests ---
    test("validate skills: valid skill passes", () => {
        const skill: SkillDir = {
            name: "test-skill",
            skillFile: "/path/to/SKILL.md",
            files: ["/path/to/SKILL.md"],
        };
        const result = adapter.validate("skills", skill);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    test("validate skills: missing name fails", () => {
        const skill = {
            skillFile: "/path/to/SKILL.md",
            files: [],
        };
        const result = adapter.validate("skills", skill);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Skill must have a name");
    });

    test("validate rules: valid rule passes", () => {
        const rule: RuleFile = {
            name: "test-rule",
            content: "# Rule content",
        };
        const result = adapter.validate("rules", rule);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    test("validate agents: valid agent passes", () => {
        const agent: AgentFile = {
            name: "test-agent",
            content: "# Agent content",
            frontmatter: {
                name: "test-agent",
            },
        };
        const result = adapter.validate("agents", agent);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    test("validate memory: valid memory passes", () => {
        const memory: MemoryFile = {
            filename: "GEMINI.md",
            content: "# Memory content",
        };
        const result = adapter.validate("memory", memory);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    test("validate memory: wrong filename fails", () => {
        const memory: MemoryFile = {
            filename: "CLAUDE.md",
            content: "# Memory content",
        };
        const result = adapter.validate("memory", memory);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Memory file must be named GEMINI.md for Antigravity");
    });

    test("validate commands: valid command passes", () => {
        const command: CommandFile = {
            name: "test-command",
            content: "# Command content",
        };
        const result = adapter.validate("commands", command);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
    });
});
