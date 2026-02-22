import type { AIToolPathConfig } from "./types.js";

/**
 * Registry of all supported AI agents and their path configurations.
 * Each agent defines where it expects skills, rules, agents, memory, and commands.
 */
export const AI_TOOL_PATHS: readonly AIToolPathConfig[] = [
  {
    key: "claude-code",
    name: "Claude Code",
    skills: {
      project: ".claude/skills/{name}",
      global: "~/.claude/skills/{name}",
    },
    rules: {
      project: ".claude/rules/{name}.md",
      global: "~/.claude/rules/{name}.md",
    },
    agents: {
      project: ".claude/agents/{name}.md",
      global: "~/.claude/agents/{name}.md",
    },
    memory: {
      project: "CLAUDE.md",
      global: "~/.claude/CLAUDE.md",
    },
    commands: {
      project: ".claude/commands/{name}.md",
      global: "~/.claude/commands/{name}.md",
    },
    detectionConfig: {
      groups: [
        [{ type: "binary", name: "claude", versionPattern: /claude/i }],
        [{ type: "directory", path: "~/.claude/", markerFile: "settings.json" }],
      ],
    },
    legacy: {},
  },
  {
    key: "cursor",
    name: "Cursor",
    skills: {
      project: ".cursor/skills/{name}",
      global: "~/.cursor/skills/{name}",
    },
    rules: {
      project: ".cursor/rules/{name}.mdc",
      global: "~/.cursor/rules/{name}.mdc",
    },
    agents: {
      project: ".cursor/agents/{name}.md",
      global: "~/.cursor/agents/{name}.md",
    },
    memory: {
      project: "AGENTS.md",
      global: "~/.cursor/AGENTS.md",
    },
    commands: {
      project: ".cursor/commands/{name}.md",
      global: "~/.cursor/commands/{name}.md",
    },
    detectionConfig: {
      groups: [
        [{ type: "app", name: "Cursor.app" }],
        [{ type: "binary", name: "cursor" }],
        [{ type: "directory", path: "~/.cursor/", markerFile: "extensions" }],
      ],
    },
    legacy: {
      rules: [".cursorrules"],
    },
  },
  {
    key: "windsurf",
    name: "Windsurf",
    skills: {
      project: ".windsurf/skills/{name}",
      global: "~/.codeium/windsurf/skills/{name}",
    },
    rules: {
      project: ".windsurf/rules/{name}.md",
      global: "~/.codeium/windsurf/rules/{name}.md",
    },
    agents: {
      project: ".windsurf/agents/{name}.md",
      global: "~/.codeium/windsurf/agents/{name}.md",
    },
    memory: {
      project: "AGENTS.md",
      global: "~/.codeium/windsurf/AGENTS.md",
    },
    commands: {
      project: ".windsurf/workflows/{name}.md",
      global: "~/.codeium/windsurf/workflows/{name}.md",
    },
    detectionConfig: {
      groups: [
        [{ type: "app", name: "Windsurf.app" }],
        [{ type: "binary", name: "windsurf" }],
        [
          {
            type: "directory",
            path: "~/.codeium/windsurf/",
            markerFile: "settings.json",
          },
        ],
      ],
    },
    legacy: {
      rules: [".windsurfrules"],
    },
  },
  {
    key: "antigravity",
    name: "Antigravity",
    skills: {
      project: ".agent/skills/{name}",
      global: "~/.gemini/antigravity/skills/{name}",
    },
    rules: {
      project: ".agent/rules/{name}.md",
      global: "~/.gemini/antigravity/rules/{name}.md",
    },
    agents: {
      project: ".agent/agents/{name}.md",
      global: "~/.gemini/antigravity/agents/{name}.md",
    },
    memory: {
      project: "GEMINI.md",
      global: "~/.gemini/antigravity/GEMINI.md",
    },
    commands: {
      project: ".agent/workflows/{name}.md",
      global: "~/.gemini/antigravity/workflows/{name}.md",
    },
    detectionConfig: {
      groups: [
        [{ type: "app", name: "Antigravity.app" }],
        [{ type: "binary", name: "agy" }],
        [{ type: "binary", name: "antigravity", platforms: ["linux"] }],
        [
          {
            type: "directory",
            path: "~/.gemini/antigravity/",
            markerFile: "settings.json",
          },
        ],
      ],
    },
    legacy: {},
  },
  {
    key: "codex",
    name: "Codex CLI",
    skills: {
      project: ".codex/skills/{name}",
      global: "~/.codex/skills/{name}",
    },
    rules: {
      project: ".codex/rules/{name}.md",
      global: "~/.codex/rules/{name}.md",
    },
    agents: {
      project: ".codex/agents/{name}.md",
      global: "~/.codex/agents/{name}.md",
    },
    memory: {
      project: "AGENTS.md",
      global: "~/.codex/AGENTS.md",
    },
    commands: {
      project: ".codex/commands/{name}.md",
      global: "~/.codex/commands/{name}.md",
    },
    detectionConfig: {
      groups: [
        [{ type: "binary", name: "codex", versionPattern: /codex/i }],
        [{ type: "directory", path: "~/.codex/", markerFile: "config.toml" }],
      ],
    },
    legacy: {},
  },
  {
    key: "github-copilot",
    name: "GitHub Copilot",
    skills: {
      project: ".github/skills/{name}",
      global: "~/.github/skills/{name}",
    },
    rules: {
      project: ".github/copilot-instructions.md",
      global: "~/.github/copilot-instructions.md",
    },
    agents: {
      project: ".github/agents/{name}.md",
      global: "~/.github/agents/{name}.md",
    },
    memory: {
      project: ".github/copilot-instructions.md",
      global: "~/.github/copilot-instructions.md",
    },
    commands: {
      project: ".github/copilot/commands/{name}.md",
      global: "~/.github/copilot/commands/{name}.md",
    },
    detectionConfig: {
      groups: [
        [
          {
            type: "binary",
            name: "copilot",
            versionPattern: /copilot|github/i,
          },
        ],
        [
          {
            type: "vscode-extension",
            extensionId: "GitHub.copilot",
            editors: ["vscode", "cursor"],
          },
        ],
        [{ type: "directory", path: "~/.github/copilot/" }],
      ],
    },
    legacy: {},
  },
  {
    key: "opencode",
    name: "OpenCode",
    skills: {
      project: ".opencode/skills/{name}",
      global: "~/.config/opencode/skills/{name}",
    },
    rules: {
      project: ".opencode/rules/{name}.md",
      global: "~/.config/opencode/rules/{name}.md",
    },
    agents: {
      project: ".opencode/agents/{name}.md",
      global: "~/.config/opencode/agents/{name}.md",
    },
    memory: {
      project: "AGENTS.md",
      global: "~/.config/opencode/AGENTS.md",
    },
    commands: {
      project: ".opencode/commands/{name}.md",
      global: "~/.config/opencode/commands/{name}.md",
    },
    detectionConfig: {
      groups: [
        [{ type: "binary", name: "opencode", versionPattern: /opencode|sst/i }],
        [
          {
            type: "directory",
            path: "~/.config/opencode/",
            markerFile: "config.yaml",
          },
        ],
      ],
    },
    legacy: {},
  },
  {
    key: "amp",
    name: "Amp",
    skills: {
      project: ".agents/skills/{name}",
      global: "~/.config/agents/skills/{name}",
    },
    rules: {
      project: ".agents/rules/{name}.md",
      global: "~/.config/agents/rules/{name}.md",
    },
    agents: {
      project: ".agents/agents/{name}.md",
      global: "~/.config/agents/agents/{name}.md",
    },
    memory: {
      project: "AGENTS.md",
      global: "~/.config/agents/AGENTS.md",
    },
    commands: {
      project: ".agents/commands/{name}.md",
      global: "~/.config/agents/commands/{name}.md",
    },
    detectionConfig: {
      groups: [
        [{ type: "binary", name: "amp", versionPattern: /amp|sourcegraph/i }],
        [{ type: "directory", path: "~/.ampcache/" }],
      ],
    },
    legacy: {},
  },
  {
    key: "kiro",
    name: "Kiro",
    skills: {
      project: ".kiro/skills/{name}",
      global: "~/.kiro/skills/{name}",
    },
    rules: {
      project: ".kiro/rules/{name}.md",
      global: "~/.kiro/rules/{name}.md",
    },
    agents: {
      project: ".kiro/agents/{name}.md",
      global: "~/.kiro/agents/{name}.md",
    },
    memory: {
      project: "AGENTS.md",
      global: "~/.kiro/AGENTS.md",
    },
    commands: {
      project: ".kiro/commands/{name}.md",
      global: "~/.kiro/commands/{name}.md",
    },
    detectionConfig: {
      groups: [
        [{ type: "app", name: "Kiro.app" }],
        [{ type: "binary", name: "kiro" }],
        [{ type: "directory", path: "~/.kiro/", markerFile: "settings.json" }],
      ],
    },
    legacy: {},
  },
  {
    key: "zed",
    name: "Zed",
    skills: {
      project: ".zed/skills/{name}",
      global: "~/.zed/skills/{name}",
    },
    rules: {
      project: ".zed/rules/{name}.md",
      global: "~/.zed/rules/{name}.md",
    },
    agents: {
      project: ".zed/agents/{name}.md",
      global: "~/.zed/agents/{name}.md",
    },
    memory: {
      project: "AGENTS.md",
      global: "~/.zed/AGENTS.md",
    },
    commands: {
      project: ".zed/commands/{name}.md",
      global: "~/.zed/commands/{name}.md",
    },
    detectionConfig: {
      groups: [
        [{ type: "app", name: "Zed.app" }],
        [{ type: "binary", name: "zed" }],
        [
          {
            type: "directory",
            path: "~/.config/zed/",
            markerFile: "settings.json",
          },
        ],
      ],
    },
    legacy: {},
  },
  {
    key: "cline",
    name: "Cline",
    skills: {
      project: ".cline/skills/{name}",
      global: "~/.cline/skills/{name}",
    },
    rules: {
      project: ".cline/rules/{name}.md",
      global: "~/.cline/rules/{name}.md",
    },
    agents: {
      project: ".cline/agents/{name}.md",
      global: "~/.cline/agents/{name}.md",
    },
    memory: {
      project: "AGENTS.md",
      global: "~/.cline/AGENTS.md",
    },
    commands: {
      project: ".cline/commands/{name}.md",
      global: "~/.cline/commands/{name}.md",
    },
    detectionConfig: {
      groups: [
        [
          {
            type: "vscode-extension",
            extensionId: "saoudrizwan.claude-dev",
            editors: ["vscode", "cursor", "windsurf"],
          },
        ],
        [
          {
            type: "directory",
            path: "~/.cline/",
            markerFile: "settings.json",
          },
        ],
      ],
    },
    legacy: {},
  },
  {
    key: "roo",
    name: "Roo",
    skills: {
      project: ".roo/skills/{name}",
      global: "~/.roo/skills/{name}",
    },
    rules: {
      project: ".roo/rules/{name}.md",
      global: "~/.roo/rules/{name}.md",
    },
    agents: {
      project: ".roo/agents/{name}.md",
      global: "~/.roo/agents/{name}.md",
    },
    memory: {
      project: "AGENTS.md",
      global: "~/.roo/AGENTS.md",
    },
    commands: {
      project: ".roo/commands/{name}.md",
      global: "~/.roo/commands/{name}.md",
    },
    detectionConfig: {
      groups: [
        [
          {
            type: "vscode-extension",
            extensionId: "RooVeterinaryInc.roo-cline",
            editors: ["vscode", "cursor", "windsurf"],
          },
        ],
        [{ type: "directory", path: "~/.roo/", markerFile: "settings.json" }],
      ],
    },
    legacy: {},
  },
  {
    key: "junie",
    name: "Junie",
    skills: {
      project: ".junie/skills/{name}",
      global: "~/.junie/skills/{name}",
    },
    rules: {
      project: ".junie/rules/{name}.md",
      global: "~/.junie/rules/{name}.md",
    },
    agents: {
      project: ".junie/agents/{name}.md",
      global: "~/.junie/agents/{name}.md",
    },
    memory: {
      project: "AGENTS.md",
      global: "~/.junie/AGENTS.md",
    },
    commands: {
      project: ".junie/commands/{name}.md",
      global: "~/.junie/commands/{name}.md",
    },
    detectionConfig: {
      groups: [
        [{ type: "jetbrains-plugin", pluginId: "junie" }],
        [
          {
            type: "directory",
            path: "~/.junie/",
            markerFile: "settings.json",
          },
        ],
      ],
    },
    legacy: {},
  },
  {
    key: "trae",
    name: "Trae",
    skills: {
      project: ".trae/skills/{name}",
      global: "~/.trae/skills/{name}",
    },
    rules: {
      project: ".trae/rules/{name}.md",
      global: "~/.trae/rules/{name}.md",
    },
    agents: {
      project: ".trae/agents/{name}.md",
      global: "~/.trae/agents/{name}.md",
    },
    memory: {
      project: "AGENTS.md",
      global: "~/.trae/AGENTS.md",
    },
    commands: {
      project: ".trae/commands/{name}.md",
      global: "~/.trae/commands/{name}.md",
    },
    detectionConfig: {
      groups: [
        [{ type: "app", name: "Trae.app" }],
        [{ type: "directory", path: "~/.trae/", markerFile: "settings.json" }],
      ],
    },
    legacy: {},
  },
];
