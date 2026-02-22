import { describe, expect, it } from "vitest";
import { AI_TOOL_PATHS } from "./registry.js";
import type { AIToolPathConfig } from "./types.js";

describe("AI_TOOL_PATHS registry", () => {
  it("should have exactly 14 registered agents", () => {
    expect(AI_TOOL_PATHS).toHaveLength(14);
  });

  it("should have unique agent keys", () => {
    const keys = AI_TOOL_PATHS.map((agent) => agent.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it("should include all expected agent keys", () => {
    const keys = AI_TOOL_PATHS.map((agent) => agent.key);
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

  describe("All agents should have valid structure", () => {
    const configTypes = ["skills", "rules", "agents", "memory", "commands"] as const;

    for (const agent of AI_TOOL_PATHS) {
      describe(`${agent.name} (${agent.key})`, () => {
        it("should have required metadata fields", () => {
          expect(agent.key).toBeTruthy();
          expect(agent.name).toBeTruthy();
          expect(agent.legacy).toBeDefined();
        });

        it("should have detectionConfig with at least one group", () => {
          expect(agent.detectionConfig).toBeDefined();
          expect(agent.detectionConfig?.groups.length).toBeGreaterThan(0);
        });

        for (const configType of configTypes) {
          it(`should have valid ${configType} paths`, () => {
            const config = agent[configType] as { project: string; global: string };
            expect(config).toBeDefined();
            expect(config.project).toBeTruthy();
            expect(config.global).toBeTruthy();
            expect(typeof config.project).toBe("string");
            expect(typeof config.global).toBe("string");
          });

          it(`should have consistent scope structure for ${configType}`, () => {
            const config = agent[configType] as { project: string; global: string };
            expect(config).toHaveProperty("project");
            expect(config).toHaveProperty("global");
          });
        }
      });
    }
  });

  describe("Path template validation", () => {
    it("should use {name} placeholder in skills paths for all agents", () => {
      for (const agent of AI_TOOL_PATHS) {
        expect(agent.skills.project).toContain("{name}");
        expect(agent.skills.global).toContain("{name}");
      }
    });

    it("should use {name} placeholder in rules paths for all agents except github-copilot", () => {
      for (const agent of AI_TOOL_PATHS) {
        // github-copilot uses a static copilot-instructions.md path without {name}
        if (agent.key === "github-copilot") {
          continue;
        }
        expect(agent.rules.project).toContain("{name}");
        expect(agent.rules.global).toContain("{name}");
      }
    });

    it("should use {name} placeholder in agents paths for all agents", () => {
      for (const agent of AI_TOOL_PATHS) {
        expect(agent.agents.project).toContain("{name}");
        expect(agent.agents.global).toContain("{name}");
      }
    });

    it("should use {name} placeholder in commands paths for all agents", () => {
      for (const agent of AI_TOOL_PATHS) {
        expect(agent.commands.project).toContain("{name}");
        expect(agent.commands.global).toContain("{name}");
      }
    });

    it("should not use {name} placeholder in memory paths", () => {
      for (const agent of AI_TOOL_PATHS) {
        expect(agent.memory.project).not.toContain("{name}");
        expect(agent.memory.global).not.toContain("{name}");
      }
    });
  });

  describe("Global paths should use tilde prefix", () => {
    const configTypes = ["skills", "rules", "agents", "memory", "commands"] as const;

    for (const configType of configTypes) {
      it(`should use ~/ prefix for global ${configType} paths`, () => {
        for (const agent of AI_TOOL_PATHS) {
          const config = agent[configType] as { project: string; global: string };
          expect(config.global).toMatch(/^~/);
        }
      });
    }
  });

  describe("Project paths should use dot prefix", () => {
    const configTypes = ["skills", "rules", "agents", "commands"] as const;

    for (const configType of configTypes) {
      it(`should use . prefix for most project ${configType} paths`, () => {
        for (const agent of AI_TOOL_PATHS) {
          const config = agent[configType] as { project: string; global: string };
          // All these config types should start with .{agent-name}/
          // (memory is not tested here as it uses root files like CLAUDE.md, AGENTS.md)
          expect(config.project).toMatch(/^\./);
        }
      });
    }
  });

  describe("Agent-specific paths", () => {
    it("should use .mdc format for cursor rules", () => {
      const cursor = AI_TOOL_PATHS.find((a) => a.key === "cursor");
      expect(cursor?.rules.project).toContain(".mdc");
      expect(cursor?.rules.global).toContain(".mdc");
    });

    it("should use GEMINI.md for antigravity memory", () => {
      const antigravity = AI_TOOL_PATHS.find((a) => a.key === "antigravity");
      expect(antigravity?.memory.project).toBe("GEMINI.md");
      expect(antigravity?.memory.global).toContain("GEMINI.md");
    });

    it("should use CLAUDE.md for claude-code memory", () => {
      const claudeCode = AI_TOOL_PATHS.find((a) => a.key === "claude-code");
      expect(claudeCode?.memory.project).toBe("CLAUDE.md");
      expect(claudeCode?.memory.global).toContain("CLAUDE.md");
    });

    it("should use AGENTS.md for most other agents' memory", () => {
      const agentsWithAgentsMd = [
        "cursor",
        "windsurf",
        "codex",
        "opencode",
        "amp",
        "kiro",
        "zed",
        "cline",
        "roo",
        "junie",
        "trae",
      ];
      for (const key of agentsWithAgentsMd) {
        const agent = AI_TOOL_PATHS.find((a) => a.key === key);
        expect(agent?.memory.project).toBe("AGENTS.md");
      }
    });

    it("should use .codeium/windsurf/ for windsurf global paths", () => {
      const windsurf = AI_TOOL_PATHS.find((a) => a.key === "windsurf");
      expect(windsurf?.skills.global).toContain(".codeium/windsurf/");
      expect(windsurf?.rules.global).toContain(".codeium/windsurf/");
      expect(windsurf?.memory.global).toContain(".codeium/windsurf/");
    });

    it("should use .gemini/antigravity/ for antigravity global paths", () => {
      const antigravity = AI_TOOL_PATHS.find((a) => a.key === "antigravity");
      expect(antigravity?.skills.global).toContain(".gemini/antigravity/");
      expect(antigravity?.rules.global).toContain(".gemini/antigravity/");
      expect(antigravity?.memory.global).toContain(".gemini/antigravity/");
    });

    it("should use .agent/ for antigravity project paths", () => {
      const antigravity = AI_TOOL_PATHS.find((a) => a.key === "antigravity");
      expect(antigravity?.skills.project).toContain(".agent/");
      expect(antigravity?.rules.project).toContain(".agent/");
    });

    it("should use .agents/ (plural) for amp project paths", () => {
      const amp = AI_TOOL_PATHS.find((a) => a.key === "amp");
      expect(amp?.skills.project).toContain(".agents/");
      expect(amp?.rules.project).toContain(".agents/");
    });

    it("should use ~/.config/ for opencode and amp global paths", () => {
      const opencode = AI_TOOL_PATHS.find((a) => a.key === "opencode");
      const amp = AI_TOOL_PATHS.find((a) => a.key === "amp");
      expect(opencode?.skills.global).toContain("~/.config/opencode/");
      expect(amp?.skills.global).toContain("~/.config/agents/");
    });

    it("should use .github/ paths for github-copilot", () => {
      const githubCopilot = AI_TOOL_PATHS.find((a) => a.key === "github-copilot");
      expect(githubCopilot?.skills.project).toContain(".github/");
      expect(githubCopilot?.memory.project).toBe(".github/copilot-instructions.md");
    });

    it("should use workflows/ subdirectory for windsurf and antigravity commands", () => {
      const windsurf = AI_TOOL_PATHS.find((a) => a.key === "windsurf");
      const antigravity = AI_TOOL_PATHS.find((a) => a.key === "antigravity");
      expect(windsurf?.commands.project).toContain("/workflows/");
      expect(antigravity?.commands.project).toContain("/workflows/");
    });
  });

  describe("Legacy paths", () => {
    it("should have legacy rules path for cursor", () => {
      const cursor = AI_TOOL_PATHS.find((a) => a.key === "cursor");
      expect(cursor?.legacy.rules).toEqual([".cursorrules"]);
    });

    it("should have legacy rules path for windsurf", () => {
      const windsurf = AI_TOOL_PATHS.find((a) => a.key === "windsurf");
      expect(windsurf?.legacy.rules).toEqual([".windsurfrules"]);
    });

    it("should have empty legacy object for agents without legacy paths", () => {
      const agentsWithoutLegacy = [
        "claude-code",
        "antigravity",
        "codex",
        "github-copilot",
        "opencode",
        "amp",
        "kiro",
        "zed",
        "cline",
        "roo",
        "junie",
        "trae",
      ];
      for (const key of agentsWithoutLegacy) {
        const agent = AI_TOOL_PATHS.find((a) => a.key === key);
        expect(agent?.legacy).toEqual({});
      }
    });
  });

  describe("Detection configuration", () => {
    it("should have detectionConfig for all agents", () => {
      for (const agent of AI_TOOL_PATHS) {
        expect(agent.detectionConfig).toBeDefined();
        expect(agent.detectionConfig?.groups.length).toBeGreaterThan(0);
      }
    });

    it("each detectionConfig group should have at least one check", () => {
      for (const agent of AI_TOOL_PATHS) {
        for (const group of agent.detectionConfig?.groups ?? []) {
          expect(group.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("Type consistency", () => {
    it("should satisfy AIToolPathConfig type for all agents", () => {
      for (const agent of AI_TOOL_PATHS) {
        const typed: AIToolPathConfig = agent;
        expect(typed).toBeDefined();
      }
    });

    it("should have consistent property names across all agents", () => {
      const requiredProperties = [
        "key",
        "name",
        "skills",
        "rules",
        "agents",
        "memory",
        "commands",
        "legacy",
      ];
      for (const agent of AI_TOOL_PATHS) {
        for (const prop of requiredProperties) {
          expect(agent).toHaveProperty(prop);
        }
      }
    });
  });
});
