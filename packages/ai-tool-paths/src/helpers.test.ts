import { homedir } from "node:os";
import { describe, expect, it } from "vitest";
import { getAIToolConfig, getAIToolPath, getAllAIToolKeys, getLegacyPaths } from "./helpers.js";
import { AIToolNotFoundError } from "./types.js";

describe("getAIToolConfig", () => {
    it("should return config for valid agent key", () => {
        const config = getAIToolConfig("claude-code");
        expect(config.key).toBe("claude-code");
        expect(config.name).toBe("Claude Code");
        expect(config.skills).toBeDefined();
    });

    it("should throw AIToolNotFoundError for unknown agent key", () => {
        expect(() => getAIToolConfig("unknown-agent")).toThrow(AIToolNotFoundError);
        expect(() => getAIToolConfig("unknown-agent")).toThrow(
            "Agent with key 'unknown-agent' not found in registry",
        );
    });
});

describe("getAllAIToolKeys", () => {
    it("should return all 14 agent keys", () => {
        const keys = getAllAIToolKeys();
        expect(keys).toHaveLength(14);
        expect(keys).toContain("claude-code");
        expect(keys).toContain("cursor");
        expect(keys).toContain("windsurf");
        expect(keys).toContain("antigravity");
        expect(keys).toContain("codex");
        expect(keys).toContain("github-copilot");
        expect(keys).toContain("opencode");
        expect(keys).toContain("amp");
        expect(keys).toContain("kiro");
        expect(keys).toContain("zed");
        expect(keys).toContain("cline");
        expect(keys).toContain("roo");
        expect(keys).toContain("junie");
        expect(keys).toContain("trae");
    });
});

describe("getAIToolPath", () => {
    it("should resolve project path without name placeholder", () => {
        const path = getAIToolPath("claude-code", "memory", "project");
        expect(path).toBe("CLAUDE.md");
    });

    it("should resolve global path with tilde expansion", () => {
        const path = getAIToolPath("claude-code", "memory", "global");
        expect(path).toBe(`${homedir()}/.claude/CLAUDE.md`);
    });

    it("should replace {name} placeholder with provided name", () => {
        const path = getAIToolPath("claude-code", "skills", "project", "code-review");
        expect(path).toBe(".claude/skills/code-review");
    });

    it("should replace {name} placeholder in global path", () => {
        const path = getAIToolPath("cursor", "rules", "global", "my-rule");
        expect(path).toBe(`${homedir()}/.cursor/rules/my-rule.mdc`);
    });

    it("should work for all config types", () => {
        expect(getAIToolPath("claude-code", "skills", "project", "test")).toBe(
            ".claude/skills/test",
        );
        expect(getAIToolPath("claude-code", "rules", "project", "test")).toBe(
            ".claude/rules/test.md",
        );
        expect(getAIToolPath("claude-code", "agents", "project", "test")).toBe(
            ".claude/agents/test.md",
        );
        expect(getAIToolPath("claude-code", "memory", "project")).toBe("CLAUDE.md");
        expect(getAIToolPath("claude-code", "commands", "project", "test")).toBe(
            ".claude/commands/test.md",
        );
    });

    it("should work for all agents", () => {
        const agents = getAllAIToolKeys();
        for (const agent of agents) {
            expect(() => getAIToolPath(agent, "memory", "project")).not.toThrow();
            expect(() => getAIToolPath(agent, "skills", "global", "test")).not.toThrow();
        }
    });

    it("should handle cursor .mdc format", () => {
        const path = getAIToolPath("cursor", "rules", "project", "my-rule");
        expect(path).toBe(".cursor/rules/my-rule.mdc");
    });

    it("should handle windsurf global path with .codeium prefix", () => {
        const path = getAIToolPath("windsurf", "memory", "global");
        expect(path).toBe(`${homedir()}/.codeium/windsurf/AGENTS.md`);
    });

    it("should handle antigravity GEMINI.md memory", () => {
        const path = getAIToolPath("antigravity", "memory", "project");
        expect(path).toBe("GEMINI.md");
    });

    it("should throw AIToolNotFoundError for unknown agent", () => {
        expect(() => getAIToolPath("unknown", "memory", "project")).toThrow(AIToolNotFoundError);
    });
});

describe("getLegacyPaths", () => {
    it("should return empty array for agents with no legacy paths", () => {
        const paths = getLegacyPaths("claude-code", "rules");
        expect(paths).toEqual([]);
    });

    it("should return .cursorrules for cursor rules", () => {
        const paths = getLegacyPaths("cursor", "rules");
        expect(paths).toEqual([".cursorrules"]);
    });

    it("should return .windsurfrules for windsurf rules", () => {
        const paths = getLegacyPaths("windsurf", "rules");
        expect(paths).toEqual([".windsurfrules"]);
    });

    it("should return empty array for non-legacy config types", () => {
        expect(getLegacyPaths("cursor", "skills")).toEqual([]);
        expect(getLegacyPaths("cursor", "memory")).toEqual([]);
    });

    it("should throw AIToolNotFoundError for unknown agent", () => {
        expect(() => getLegacyPaths("unknown", "rules")).toThrow(AIToolNotFoundError);
    });
});
