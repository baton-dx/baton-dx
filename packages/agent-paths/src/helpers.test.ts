import { homedir } from "node:os";
import { describe, expect, it } from "vitest";
import { getAgentConfig, getAgentPath, getAllAgentKeys, getLegacyPaths } from "./helpers.js";
import { AgentNotFoundError } from "./types.js";

describe("getAgentConfig", () => {
  it("should return config for valid agent key", () => {
    const config = getAgentConfig("claude-code");
    expect(config.key).toBe("claude-code");
    expect(config.name).toBe("Claude Code");
    expect(config.skills).toBeDefined();
  });

  it("should throw AgentNotFoundError for unknown agent key", () => {
    expect(() => getAgentConfig("unknown-agent")).toThrow(AgentNotFoundError);
    expect(() => getAgentConfig("unknown-agent")).toThrow(
      "Agent with key 'unknown-agent' not found in registry",
    );
  });
});

describe("getAllAgentKeys", () => {
  it("should return all 14 agent keys", () => {
    const keys = getAllAgentKeys();
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

describe("getAgentPath", () => {
  it("should resolve project path without name placeholder", () => {
    const path = getAgentPath("claude-code", "memory", "project");
    expect(path).toBe("CLAUDE.md");
  });

  it("should resolve global path with tilde expansion", () => {
    const path = getAgentPath("claude-code", "memory", "global");
    expect(path).toBe(`${homedir()}/.claude/CLAUDE.md`);
  });

  it("should replace {name} placeholder with provided name", () => {
    const path = getAgentPath("claude-code", "skills", "project", "code-review");
    expect(path).toBe(".claude/skills/code-review");
  });

  it("should replace {name} placeholder in global path", () => {
    const path = getAgentPath("cursor", "rules", "global", "my-rule");
    expect(path).toBe(`${homedir()}/.cursor/rules/my-rule.mdc`);
  });

  it("should work for all config types", () => {
    expect(getAgentPath("claude-code", "skills", "project", "test")).toBe(".claude/skills/test");
    expect(getAgentPath("claude-code", "rules", "project", "test")).toBe(".claude/rules/test.md");
    expect(getAgentPath("claude-code", "agents", "project", "test")).toBe(".claude/agents/test.md");
    expect(getAgentPath("claude-code", "memory", "project")).toBe("CLAUDE.md");
    expect(getAgentPath("claude-code", "settings", "project")).toBe(".claude/settings.json");
    expect(getAgentPath("claude-code", "commands", "project", "test")).toBe(
      ".claude/commands/test.md",
    );
  });

  it("should work for all agents", () => {
    const agents = getAllAgentKeys();
    for (const agent of agents) {
      expect(() => getAgentPath(agent, "memory", "project")).not.toThrow();
      expect(() => getAgentPath(agent, "skills", "global", "test")).not.toThrow();
    }
  });

  it("should handle cursor .mdc format", () => {
    const path = getAgentPath("cursor", "rules", "project", "my-rule");
    expect(path).toBe(".cursor/rules/my-rule.mdc");
  });

  it("should handle windsurf global path with .codeium prefix", () => {
    const path = getAgentPath("windsurf", "memory", "global");
    expect(path).toBe(`${homedir()}/.codeium/windsurf/AGENTS.md`);
  });

  it("should handle codex TOML settings", () => {
    const path = getAgentPath("codex", "settings", "project");
    expect(path).toBe(".codex/config.toml");
  });

  it("should handle antigravity GEMINI.md memory", () => {
    const path = getAgentPath("antigravity", "memory", "project");
    expect(path).toBe("GEMINI.md");
  });

  it("should throw AgentNotFoundError for unknown agent", () => {
    expect(() => getAgentPath("unknown", "memory", "project")).toThrow(AgentNotFoundError);
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

  it("should throw AgentNotFoundError for unknown agent", () => {
    expect(() => getLegacyPaths("unknown", "rules")).toThrow(AgentNotFoundError);
  });
});
