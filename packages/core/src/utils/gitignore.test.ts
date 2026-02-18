import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ToolAdapter } from "../adapters/types.js";
import {
  collectProfileSupportPatterns,
  collectSyncedPatterns,
  updateGitignore,
} from "./gitignore.js";

/** Minimal mock adapter that implements getPath for all config types */
function mockAdapter(key: string, commandDir: string, paths?: Record<string, string>): ToolAdapter {
  return {
    key,
    name: key,
    isInstalled: async () => true,
    getPath: (type, _scope, name) => {
      if (type === "commands") return `${commandDir}/${name}.md`;
      if (paths?.[type]) return paths[type].replace("{name}", name);
      return "";
    },
    getLegacyPaths: () => [],
    transformSkill: (s) => s,
    transformRule: (r) => r,
    transformAgent: (a) => a,
    transformMemory: (m) => m,
    transformCommand: (c) => c,
    validate: () => ({ valid: true, errors: [] }),
  };
}

describe("collectSyncedPatterns", () => {
  it("returns empty array when no patterns are needed", () => {
    const result = collectSyncedPatterns({
      adapters: [],
      commandNames: [],
      fileTargets: [],
      ideTargets: [],
      skillNames: [],
      ruleNames: [],
      memoryNames: [],
    });
    expect(result).toEqual([]);
  });

  it("returns commands directory patterns per adapter", () => {
    const adapters = [
      mockAdapter("claude-code", ".claude/commands"),
      mockAdapter("cursor", ".cursor/commands"),
    ];
    const result = collectSyncedPatterns({
      adapters,
      commandNames: ["review"],
      fileTargets: [],
      ideTargets: [],
      skillNames: [],
      ruleNames: [],
      memoryNames: [],
    });
    expect(result).toContain(".claude/commands/");
    expect(result).toContain(".cursor/commands/");
  });

  it("returns file target patterns", () => {
    const result = collectSyncedPatterns({
      adapters: [],
      commandNames: [],
      fileTargets: ["biome.json", ".editorconfig"],
      ideTargets: [],
      skillNames: [],
      ruleNames: [],
      memoryNames: [],
    });
    expect(result).toContain("biome.json");
    expect(result).toContain(".editorconfig");
  });

  it("returns IDE directory patterns with trailing slash", () => {
    const result = collectSyncedPatterns({
      adapters: [],
      commandNames: [],
      fileTargets: [],
      ideTargets: [".vscode/", ".idea/"],
      skillNames: [],
      ruleNames: [],
      memoryNames: [],
    });
    expect(result).toContain(".vscode/");
    expect(result).toContain(".idea/");
  });

  it("ensures trailing slash on IDE targets", () => {
    const result = collectSyncedPatterns({
      adapters: [],
      commandNames: [],
      fileTargets: [],
      ideTargets: [".vscode"],
      skillNames: [],
      ruleNames: [],
      memoryNames: [],
    });
    expect(result).toContain(".vscode/");
  });

  it("returns deduplicated, sorted patterns", () => {
    const adapters = [mockAdapter("claude-code", ".claude/commands")];
    const result = collectSyncedPatterns({
      adapters,
      commandNames: ["review", "test"],
      fileTargets: ["biome.json", ".editorconfig"],
      ideTargets: [".vscode/"],
      skillNames: [],
      ruleNames: [],
      memoryNames: [],
    });
    // Should be sorted
    const sorted = [...result].sort();
    expect(result).toEqual(sorted);
  });

  it("does not add command patterns when commandNames is empty", () => {
    const adapters = [mockAdapter("claude-code", ".claude/commands")];
    const result = collectSyncedPatterns({
      adapters,
      commandNames: [],
      fileTargets: [],
      ideTargets: [],
      skillNames: [],
      ruleNames: [],
      memoryNames: [],
    });
    expect(result).toEqual([]);
  });

  it("returns skill directory patterns per adapter", () => {
    const adapters = [
      mockAdapter("claude-code", ".claude/commands", { skills: ".claude/skills/{name}" }),
    ];
    const result = collectSyncedPatterns({
      adapters,
      commandNames: [],
      fileTargets: [],
      ideTargets: [],
      skillNames: ["component-gen"],
      ruleNames: [],
      memoryNames: [],
    });
    expect(result).toContain(".claude/skills/");
  });

  it("returns rule directory patterns per adapter", () => {
    const adapters = [
      mockAdapter("claude-code", ".claude/commands", { rules: ".claude/rules/{name}.md" }),
    ];
    const result = collectSyncedPatterns({
      adapters,
      commandNames: [],
      fileTargets: [],
      ideTargets: [],
      skillNames: [],
      ruleNames: ["coding-standards"],
      memoryNames: [],
    });
    expect(result).toContain(".claude/rules/");
  });

  it("returns memory file patterns per adapter", () => {
    const adapters = [
      mockAdapter("claude-code", ".claude/commands", { memory: ".claude/memory/{name}" }),
    ];
    const result = collectSyncedPatterns({
      adapters,
      commandNames: [],
      fileTargets: [],
      ideTargets: [],
      skillNames: [],
      ruleNames: [],
      memoryNames: ["MEMORY.md"],
    });
    expect(result).toContain(".claude/memory/");
  });

  it("handles static paths without {name} placeholder (e.g., copilot-instructions.md)", () => {
    const adapters = [
      mockAdapter("github-copilot", ".github/commands", {
        rules: ".github/copilot-instructions.md",
        memory: ".github/copilot-instructions.md",
      }),
    ];
    const result = collectSyncedPatterns({
      adapters,
      commandNames: [],
      fileTargets: [],
      ideTargets: [],
      skillNames: [],
      ruleNames: ["coding-standards"],
      memoryNames: ["MEMORY.md"],
    });
    // Both rules and memory resolve to the same directory
    expect(result).toContain(".github/");
  });
});

describe("updateGitignore", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `baton-gitignore-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("creates .gitignore with managed section when it does not exist", async () => {
    const updated = await updateGitignore(tmpDir, [".vscode/", "biome.json"]);
    expect(updated).toBe(true);

    const content = await readFile(join(tmpDir, ".gitignore"), "utf-8");
    expect(content).toContain("# Baton managed");
    expect(content).toContain(".vscode/");
    expect(content).toContain("biome.json");
    expect(content).toContain("# End Baton managed");
  });

  it("appends managed section to existing .gitignore", async () => {
    await writeFile(join(tmpDir, ".gitignore"), "node_modules/\n.env\n", "utf-8");

    const updated = await updateGitignore(tmpDir, [".vscode/"]);
    expect(updated).toBe(true);

    const content = await readFile(join(tmpDir, ".gitignore"), "utf-8");
    expect(content).toContain("node_modules/");
    expect(content).toContain(".env");
    expect(content).toContain("# Baton managed");
    expect(content).toContain(".vscode/");
  });

  it("replaces existing managed section with new patterns", async () => {
    const initial = "node_modules/\n\n# Baton managed\n.vscode/\n# End Baton managed\n";
    await writeFile(join(tmpDir, ".gitignore"), initial, "utf-8");

    const updated = await updateGitignore(tmpDir, [".idea/", ".vscode/", "biome.json"]);
    expect(updated).toBe(true);

    const content = await readFile(join(tmpDir, ".gitignore"), "utf-8");
    expect(content).toContain(".idea/");
    expect(content).toContain(".vscode/");
    expect(content).toContain("biome.json");
    // Should only have one managed section
    expect(content.match(/# Baton managed/g)?.length).toBe(1);
  });

  it("returns false when patterns are identical (idempotent)", async () => {
    await updateGitignore(tmpDir, [".vscode/"]);
    const updated = await updateGitignore(tmpDir, [".vscode/"]);
    expect(updated).toBe(false);
  });

  it("returns false when patterns array is empty", async () => {
    const updated = await updateGitignore(tmpDir, []);
    expect(updated).toBe(false);
  });

  it("preserves content before and after managed section", async () => {
    const initial =
      "# Custom\nnode_modules/\n\n# Baton managed\nold-pattern\n# End Baton managed\n\n# Other\n.env\n";
    await writeFile(join(tmpDir, ".gitignore"), initial, "utf-8");

    await updateGitignore(tmpDir, [".vscode/"]);

    const content = await readFile(join(tmpDir, ".gitignore"), "utf-8");
    expect(content).toContain("# Custom\nnode_modules/");
    expect(content).toContain("# Other\n.env");
    expect(content).not.toContain("old-pattern");
  });
});

describe("collectProfileSupportPatterns", () => {
  it("always includes baton.lock", () => {
    const result = collectProfileSupportPatterns({
      profileAiTools: [],
      profileIdePlatforms: [],
      fileTargets: [],
      hasContent: false,
    });
    expect(result).toContain("baton.lock");
  });

  it("generates patterns for all profile-supported AI tools", () => {
    const result = collectProfileSupportPatterns({
      profileAiTools: ["claude-code", "cursor"],
      profileIdePlatforms: [],
      fileTargets: [],
      hasContent: true,
    });
    // Claude Code directories
    expect(result).toContain(".claude/commands/");
    expect(result).toContain(".claude/rules/");
    expect(result).toContain(".claude/skills/");
    expect(result).toContain(".claude/agents/");
    // Claude Code memory is a root-level file
    expect(result).toContain("CLAUDE.md");
    // Cursor directories
    expect(result).toContain(".cursor/commands/");
    expect(result).toContain(".cursor/rules/");
    expect(result).toContain(".cursor/skills/");
    expect(result).toContain(".cursor/agents/");
    // Cursor memory is also root-level
    expect(result).toContain("AGENTS.md");
    // Cursor legacy path
    expect(result).toContain(".cursorrules");
    // baton.lock always present
    expect(result).toContain("baton.lock");
  });

  it("generates patterns for all profile-supported IDE platforms", () => {
    const result = collectProfileSupportPatterns({
      profileAiTools: [],
      profileIdePlatforms: ["vscode", "jetbrains"],
      fileTargets: [],
      hasContent: false,
    });
    expect(result).toContain(".vscode/");
    expect(result).toContain(".idea/");
    expect(result).toContain("baton.lock");
  });

  it("includes file targets", () => {
    const result = collectProfileSupportPatterns({
      profileAiTools: [],
      profileIdePlatforms: [],
      fileTargets: ["biome.json", ".editorconfig"],
      hasContent: false,
    });
    expect(result).toContain("biome.json");
    expect(result).toContain(".editorconfig");
    expect(result).toContain("baton.lock");
  });

  it("skips AI tool patterns when hasContent is false", () => {
    const result = collectProfileSupportPatterns({
      profileAiTools: ["claude-code"],
      profileIdePlatforms: [],
      fileTargets: [],
      hasContent: false,
    });
    expect(result).not.toContain(".claude/commands/");
    expect(result).not.toContain("CLAUDE.md");
    // baton.lock is still present
    expect(result).toContain("baton.lock");
  });

  it("includes legacy paths like .cursorrules and .windsurfrules", () => {
    const result = collectProfileSupportPatterns({
      profileAiTools: ["cursor", "windsurf"],
      profileIdePlatforms: [],
      fileTargets: [],
      hasContent: true,
    });
    expect(result).toContain(".cursorrules");
    expect(result).toContain(".windsurfrules");
  });

  it("returns deduplicated, sorted patterns", () => {
    const result = collectProfileSupportPatterns({
      profileAiTools: ["claude-code", "cursor"],
      profileIdePlatforms: ["vscode"],
      fileTargets: ["biome.json"],
      hasContent: true,
    });
    const sorted = [...result].sort();
    expect(result).toEqual(sorted);
    // Verify no duplicates
    expect(result.length).toBe(new Set(result).size);
  });

  it("handles tools that share memory file paths (e.g., AGENTS.md)", () => {
    const result = collectProfileSupportPatterns({
      profileAiTools: ["cursor", "windsurf", "kiro"],
      profileIdePlatforms: [],
      fileTargets: [],
      hasContent: true,
    });
    // All three tools use AGENTS.md — should appear only once
    const agentsCount = result.filter((p) => p === "AGENTS.md").length;
    expect(agentsCount).toBe(1);
  });

  it("generates complete patterns for a realistic profile", () => {
    const result = collectProfileSupportPatterns({
      profileAiTools: ["claude-code", "cursor", "github-copilot"],
      profileIdePlatforms: ["vscode", "jetbrains", "cursor"],
      fileTargets: ["biome.json"],
      hasContent: true,
    });
    // AI tool directories
    expect(result).toContain(".claude/commands/");
    expect(result).toContain(".cursor/commands/");
    expect(result).toContain(".github/copilot/commands/");
    // IDE directories
    expect(result).toContain(".vscode/");
    expect(result).toContain(".idea/");
    expect(result).toContain(".cursor/");
    // Root-level files
    expect(result).toContain("CLAUDE.md");
    expect(result).toContain("AGENTS.md");
    expect(result).toContain("biome.json");
    expect(result).toContain("baton.lock");
    // Legacy paths
    expect(result).toContain(".cursorrules");
  });
});
