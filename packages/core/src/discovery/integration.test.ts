import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assembleContentFromDiscovery } from "./assemble.js";
import { discoverProfile } from "./discover.js";

let tempDir: string;

beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "baton-integration-"));
});

afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
});

async function createProfile(name: string, structure: Record<string, string>): Promise<string> {
    const profileDir = join(tempDir, name);
    for (const [relativePath, content] of Object.entries(structure)) {
        const fullPath = join(profileDir, relativePath);
        await mkdir(join(fullPath, ".."), { recursive: true });
        await writeFile(fullPath, content, "utf-8");
    }
    return profileDir;
}

describe("discovery → assemble integration", () => {
    it("assembles rules from a single profile", async () => {
        const profileDir = await createProfile("single", {
            "ai/rules/coding-standards.md": "# Coding Standards\nFollow these rules.",
            "ai/rules/testing.md": "---\nscope: global\n---\n# Testing Rules",
        });

        const discovery = await discoverProfile(profileDir);
        const result = assembleContentFromDiscovery([
            { discovery, meta: { name: "single", profileScope: "project" } },
        ]);

        expect(result.rules).toHaveLength(2);
        expect(result.rules).toContainEqual({
            name: "coding-standards",
            agents: [],
            scope: "project",
            profileName: "single",
        });
        expect(result.rules).toContainEqual({
            name: "testing",
            agents: [],
            scope: "global",
            profileName: "single",
        });
    });

    it("assembles agents from a single profile", async () => {
        const profileDir = await createProfile("agents-test", {
            "ai/agents/code-reviewer.md":
                "---\nscope: project\n---\n# Code Reviewer\nReview code carefully.",
        });

        const discovery = await discoverProfile(profileDir);
        const result = assembleContentFromDiscovery([{ discovery, meta: { name: "agents-test" } }]);

        expect(result.agents).toHaveLength(1);
        expect(result.agents[0]).toEqual({
            name: "code-reviewer",
            agents: [],
            scope: "project",
            profileName: "agents-test",
        });
    });

    it("assembles skills from a single profile", async () => {
        const profileDir = await createProfile("skills-test", {
            "ai/skills/add-adapter/SKILL.md": "# Add Adapter\nCreate a new adapter.",
        });

        const discovery = await discoverProfile(profileDir);
        const result = assembleContentFromDiscovery([
            { discovery, meta: { name: "skills-test", profileScope: "project" } },
        ]);

        expect(result.skills).toHaveLength(1);
        expect(result.skills[0]).toEqual({
            name: "add-adapter",
            scope: "project",
            profileName: "skills-test",
        });
    });

    it("assembles memory with merge strategy from frontmatter", async () => {
        const profileDir = await createProfile("memory-test", {
            "ai/memory/MEMORY.md": "---\nmerge: replace\nscope: global\n---\n# Memory content",
        });

        const discovery = await discoverProfile(profileDir);
        const result = assembleContentFromDiscovery([{ discovery, meta: { name: "memory-test" } }]);

        expect(result.memory).toHaveLength(1);
        expect(result.memory[0]).toEqual({
            filename: "MEMORY.md",
            mergeStrategy: "replace",
            scope: "global",
            contributions: [{ profileName: "memory-test", mergeStrategy: "replace" }],
        });
    });

    it("assembles commands from a single profile", async () => {
        const profileDir = await createProfile("commands-test", {
            "ai/commands/deploy.md": "# Deploy\nRun the deploy pipeline.",
        });

        const discovery = await discoverProfile(profileDir);
        const result = assembleContentFromDiscovery([
            { discovery, meta: { name: "commands-test", profileScope: "project" } },
        ]);

        expect(result.commands).toHaveLength(1);
        expect(result.commands[0]).toEqual({
            name: "deploy",
            profileName: "commands-test",
            scope: "project",
        });
    });

    it("deduplicates rules across profiles (last wins)", async () => {
        const baseDir = await createProfile("base", {
            "ai/rules/coding-standards.md": "# Base coding standards",
            "ai/rules/security.md": "# Base security rules",
        });
        const overrideDir = await createProfile("override", {
            "ai/rules/coding-standards.md": "# Override coding standards",
        });

        const baseDiscovery = await discoverProfile(baseDir);
        const overrideDiscovery = await discoverProfile(overrideDir);

        const result = assembleContentFromDiscovery([
            { discovery: baseDiscovery, meta: { name: "base" } },
            { discovery: overrideDiscovery, meta: { name: "override" } },
        ]);

        expect(result.rules).toHaveLength(2);
        // "coding-standards" should come from override
        const codingStandards = result.rules.find((r) => r.name === "coding-standards");
        expect(codingStandards?.profileName).toBe("override");
        // "security" should still come from base
        const security = result.rules.find((r) => r.name === "security");
        expect(security?.profileName).toBe("base");
    });

    it("merges memory contributions from multiple profiles", async () => {
        const baseDir = await createProfile("base-mem", {
            "ai/memory/MEMORY.md": "---\nmerge: concat\n---\n# Base memory",
        });
        const overrideDir = await createProfile("override-mem", {
            "ai/memory/MEMORY.md": "---\nmerge: replace\n---\n# Override memory",
        });

        const baseDiscovery = await discoverProfile(baseDir);
        const overrideDiscovery = await discoverProfile(overrideDir);

        const result = assembleContentFromDiscovery([
            { discovery: baseDiscovery, meta: { name: "base-mem" } },
            { discovery: overrideDiscovery, meta: { name: "override-mem" } },
        ]);

        expect(result.memory).toHaveLength(1);
        expect(result.memory[0].contributions).toHaveLength(2);
        expect(result.memory[0].contributions[0].profileName).toBe("base-mem");
        expect(result.memory[0].contributions[1].profileName).toBe("override-mem");
        // Last profile wins on strategy
        expect(result.memory[0].mergeStrategy).toBe("replace");
    });

    it("inherits scope from profile when item scope is undefined", async () => {
        const profileDir = await createProfile("scope-inherit", {
            "ai/rules/no-scope.md": "# Rule without scope frontmatter",
        });

        const discovery = await discoverProfile(profileDir);
        const result = assembleContentFromDiscovery([
            { discovery, meta: { name: "scope-inherit", profileScope: "global" } },
        ]);

        expect(result.rules[0].scope).toBe("global");
    });

    it("defaults to project scope when neither item nor profile specifies scope", async () => {
        const profileDir = await createProfile("no-scope", {
            "ai/rules/rule.md": "# Rule",
        });

        const discovery = await discoverProfile(profileDir);
        const result = assembleContentFromDiscovery([{ discovery, meta: { name: "no-scope" } }]);

        expect(result.rules[0].scope).toBe("project");
    });

    it("handles empty profile (no content directories)", async () => {
        const profileDir = await createProfile("empty", {
            "baton.profile.yaml": "name: empty\n",
        });

        const discovery = await discoverProfile(profileDir);
        const result = assembleContentFromDiscovery([{ discovery, meta: { name: "empty" } }]);

        expect(result.rules).toHaveLength(0);
        expect(result.agents).toHaveLength(0);
        expect(result.skills).toHaveLength(0);
        expect(result.memory).toHaveLength(0);
        expect(result.commands).toHaveLength(0);
    });

    it("collects discovery warnings", async () => {
        const profileDir = await createProfile("warn-test", {
            // Create skills dir with no SKILL.md
            "ai/skills/broken/.gitkeep": "",
        });

        const discovery = await discoverProfile(profileDir);
        const result = assembleContentFromDiscovery([{ discovery, meta: { name: "warn-test" } }]);

        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0]).toContain("SKILL.md");
    });

    it("assembles full multi-type profile", async () => {
        const profileDir = await createProfile("full", {
            "ai/memory/MEMORY.md": "---\nmerge: append\n---\n# Memory",
            "ai/rules/rule-a.md": "# Rule A",
            "ai/rules/rule-b.md": "---\nscope: global\n---\n# Rule B",
            "ai/agents/reviewer.md": "# Reviewer agent",
            "ai/skills/deploy/SKILL.md": "# Deploy skill",
            "ai/commands/build.md": "# Build command",
        });

        const discovery = await discoverProfile(profileDir);
        const result = assembleContentFromDiscovery([
            { discovery, meta: { name: "full", profileScope: "project" } },
        ]);

        expect(result.rules).toHaveLength(2);
        expect(result.agents).toHaveLength(1);
        expect(result.skills).toHaveLength(1);
        expect(result.memory).toHaveLength(1);
        expect(result.commands).toHaveLength(1);
    });
});

describe("discovery-path scenarios", () => {
    it("discovery path produces same-shaped output as manifest merge", async () => {
        // A profile with all content types — discovery should produce
        // the same output types as the manifest merge functions
        const profileDir = await createProfile("dual-path", {
            "ai/memory/MEMORY.md": "---\nmerge: concat\nscope: project\n---\n# Project memory",
            "ai/rules/no-console.md": "# No console.log\nDo not use console.log.",
            "ai/agents/test-writer.md": "---\nscope: project\n---\n# Test Writer",
            "ai/skills/refactor/SKILL.md": "# Refactor\nRefactoring skill.",
            "ai/commands/lint.md": "# Lint\nRun linting.",
        });

        const discovery = await discoverProfile(profileDir);
        const assembled = assembleContentFromDiscovery([
            { discovery, meta: { name: "dual-path", profileScope: "project" } },
        ]);

        // Verify output types match merge function outputs
        // RuleEntry shape
        for (const rule of assembled.rules) {
            expect(rule).toHaveProperty("name");
            expect(rule).toHaveProperty("agents");
            expect(rule).toHaveProperty("scope");
            expect(rule).toHaveProperty("profileName");
            expect(Array.isArray(rule.agents)).toBe(true);
        }

        // AgentEntry shape
        for (const agent of assembled.agents) {
            expect(agent).toHaveProperty("name");
            expect(agent).toHaveProperty("agents");
            expect(agent).toHaveProperty("scope");
            expect(agent).toHaveProperty("profileName");
        }

        // MergedSkillItem shape
        for (const skill of assembled.skills) {
            expect(skill).toHaveProperty("name");
            expect(skill).toHaveProperty("scope");
            expect(skill).toHaveProperty("profileName");
        }

        // MemoryEntry shape
        for (const mem of assembled.memory) {
            expect(mem).toHaveProperty("filename");
            expect(mem).toHaveProperty("mergeStrategy");
            expect(mem).toHaveProperty("scope");
            expect(mem).toHaveProperty("contributions");
            expect(Array.isArray(mem.contributions)).toBe(true);
        }

        // CommandEntry shape
        for (const cmd of assembled.commands) {
            expect(cmd).toHaveProperty("name");
            expect(cmd).toHaveProperty("profileName");
            expect(cmd).toHaveProperty("scope");
        }
    });

    it("three-profile chain with overrides works correctly", async () => {
        const baseDir = await createProfile("base-chain", {
            "ai/rules/style.md": "# Base style rules",
            "ai/rules/testing.md": "# Base testing rules",
            "ai/agents/reviewer.md": "# Base reviewer",
            "ai/memory/MEMORY.md": "---\nmerge: concat\n---\n# Base memory",
        });
        const midDir = await createProfile("mid-chain", {
            "ai/rules/style.md": "# Mid style rules (overrides base)",
            "ai/agents/deployer.md": "# Mid deployer agent",
        });
        const topDir = await createProfile("top-chain", {
            "ai/rules/style.md": "# Top style rules (overrides all)",
            "ai/memory/MEMORY.md": "---\nmerge: replace\n---\n# Top memory",
        });

        const baseDisc = await discoverProfile(baseDir);
        const midDisc = await discoverProfile(midDir);
        const topDisc = await discoverProfile(topDir);

        const result = assembleContentFromDiscovery([
            { discovery: baseDisc, meta: { name: "base-chain" } },
            { discovery: midDisc, meta: { name: "mid-chain" } },
            { discovery: topDisc, meta: { name: "top-chain" } },
        ]);

        // "style" should come from top (last wins)
        const style = result.rules.find((r) => r.name === "style");
        expect(style?.profileName).toBe("top-chain");

        // "testing" should still come from base (no override)
        const testing = result.rules.find((r) => r.name === "testing");
        expect(testing?.profileName).toBe("base-chain");

        // "reviewer" from base, "deployer" from mid
        expect(result.agents).toHaveLength(2);
        expect(result.agents.find((a) => a.name === "reviewer")?.profileName).toBe("base-chain");
        expect(result.agents.find((a) => a.name === "deployer")?.profileName).toBe("mid-chain");

        // Memory: 2 contributions, strategy from top
        expect(result.memory[0].contributions).toHaveLength(2);
        expect(result.memory[0].mergeStrategy).toBe("replace");
    });

    it("discovery path uses all agents as universal (empty agents array)", async () => {
        const profileDir = await createProfile("universal-check", {
            "ai/rules/rule-a.md": "# Rule A",
            "ai/agents/agent-a.md": "# Agent A",
        });

        const discovery = await discoverProfile(profileDir);
        const result = assembleContentFromDiscovery([
            { discovery, meta: { name: "universal-check" } },
        ]);

        // All discovery items should be universal (empty agents array)
        for (const rule of result.rules) {
            expect(rule.agents).toEqual([]);
        }
        for (const agent of result.agents) {
            expect(agent.agents).toEqual([]);
        }
    });

    it("memory defaults to concat merge strategy for unknown values", async () => {
        const profileDir = await createProfile("bad-merge", {
            "ai/memory/MEMORY.md": "---\nmerge: invalid-strategy\n---\n# Memory",
        });

        const discovery = await discoverProfile(profileDir);
        const result = assembleContentFromDiscovery([{ discovery, meta: { name: "bad-merge" } }]);

        // "invalid-strategy" from discovery should fall back to "concat" in assembly
        expect(result.memory[0].mergeStrategy).toBe("concat");
    });
});

describe("sourceFilePaths (discovery path resolution bug fix)", () => {
    it("maps rules and agents to flat ai/ paths, not manifest-style subdirectory paths", async () => {
        const profileDir = await createProfile("path-test", {
            "ai/rules/coding-standards.md": "# Coding Standards",
            "ai/rules/security.md": "# Security Rules",
            "ai/agents/code-reviewer.md": "# Code Reviewer",
            "ai/skills/deploy/SKILL.md": "# Deploy Skill",
            "ai/commands/build.md": "# Build Command",
        });

        const discovery = await discoverProfile(profileDir);
        const result = assembleContentFromDiscovery([{ discovery, meta: { name: "path-test" } }]);

        // Rules should map to flat ai/rules/<name>.md, NOT ai/rules/universal/<name>.md
        expect(result.sourceFilePaths.get("rules/coding-standards")).toBe(
            join(profileDir, "ai", "rules", "coding-standards.md"),
        );
        expect(result.sourceFilePaths.get("rules/security")).toBe(
            join(profileDir, "ai", "rules", "security.md"),
        );

        // Agents should map to flat ai/agents/<name>.md, NOT ai/agents/universal/<name>.md
        expect(result.sourceFilePaths.get("agents/code-reviewer")).toBe(
            join(profileDir, "ai", "agents", "code-reviewer.md"),
        );

        // Skills should map to the directory path
        expect(result.sourceFilePaths.get("skills/deploy")).toBe(
            join(profileDir, "ai", "skills", "deploy"),
        );

        // Commands should map to flat ai/commands/<name>.md
        expect(result.sourceFilePaths.get("commands/build")).toBe(
            join(profileDir, "ai", "commands", "build.md"),
        );
    });

    it("last-wins deduplication updates sourceFilePaths to the winning profile", async () => {
        const baseDir = await createProfile("base-paths", {
            "ai/rules/style.md": "# Base style",
            "ai/agents/reviewer.md": "# Base reviewer",
        });
        const overrideDir = await createProfile("override-paths", {
            "ai/rules/style.md": "# Override style",
            "ai/agents/reviewer.md": "# Override reviewer",
        });

        const baseDiscovery = await discoverProfile(baseDir);
        const overrideDiscovery = await discoverProfile(overrideDir);

        const result = assembleContentFromDiscovery([
            { discovery: baseDiscovery, meta: { name: "base-paths" } },
            { discovery: overrideDiscovery, meta: { name: "override-paths" } },
        ]);

        // After deduplication, paths should point to override profile's files
        expect(result.sourceFilePaths.get("rules/style")).toBe(
            join(overrideDir, "ai", "rules", "style.md"),
        );
        expect(result.sourceFilePaths.get("agents/reviewer")).toBe(
            join(overrideDir, "ai", "agents", "reviewer.md"),
        );
    });
});

describe("files and IDE assembly", () => {
    it("assembles files from a single profile", async () => {
        const profileDir = await createProfile("files-single", {
            "baton.profile.yaml": "name: files-single\nversion: 1.0.0\n",
            "files/.editorconfig": "root = true",
            "files/biome.json": "{}",
        });

        const discovery = await discoverProfile(profileDir);
        const result = assembleContentFromDiscovery([
            { discovery, meta: { name: "files-single" } },
        ]);

        expect(result.files).toHaveLength(2);
        const targets = result.files.map((f) => f.target).sort();
        expect(targets).toEqual([".editorconfig", "biome.json"]);
        expect(result.files[0].profileName).toBe("files-single");
    });

    it("assembles nested files preserving relative paths", async () => {
        const profileDir = await createProfile("files-nested", {
            "baton.profile.yaml": "name: files-nested\nversion: 1.0.0\n",
            "files/.github/workflows/ci.yml": "name: CI",
        });

        const discovery = await discoverProfile(profileDir);
        const result = assembleContentFromDiscovery([
            { discovery, meta: { name: "files-nested" } },
        ]);

        expect(result.files).toHaveLength(1);
        expect(result.files[0].target).toBe(".github/workflows/ci.yml");
        expect(result.files[0].source).toBe(".github/workflows/ci.yml");
    });

    it("deduplicates files across profiles (last wins)", async () => {
        const baseDir = await createProfile("files-base", {
            "baton.profile.yaml": "name: files-base\nversion: 1.0.0\n",
            "files/.editorconfig": "base config",
            "files/biome.json": "base biome",
        });
        const overrideDir = await createProfile("files-override", {
            "baton.profile.yaml": "name: files-override\nversion: 1.0.0\n",
            "files/.editorconfig": "override config",
        });

        const baseDisc = await discoverProfile(baseDir);
        const overrideDisc = await discoverProfile(overrideDir);

        const result = assembleContentFromDiscovery([
            { discovery: baseDisc, meta: { name: "files-base" } },
            { discovery: overrideDisc, meta: { name: "files-override" } },
        ]);

        expect(result.files).toHaveLength(2);
        const editorconfig = result.files.find((f) => f.target === ".editorconfig");
        expect(editorconfig?.profileName).toBe("files-override");
        const biome = result.files.find((f) => f.target === "biome.json");
        expect(biome?.profileName).toBe("files-base");
    });

    it("assembles IDE files from a single profile", async () => {
        const profileDir = await createProfile("ide-single", {
            "baton.profile.yaml": "name: ide-single\nversion: 1.0.0\n",
            "ide/vscode/settings.json": "{}",
            "ide/vscode/extensions.json": "{}",
        });

        const discovery = await discoverProfile(profileDir);
        const result = assembleContentFromDiscovery([{ discovery, meta: { name: "ide-single" } }]);

        expect(result.ide).toHaveLength(2);
        const fileNames = result.ide.map((i) => i.fileName).sort();
        expect(fileNames).toEqual(["extensions.json", "settings.json"]);
        expect(result.ide[0].ideKey).toBe("vscode");
        expect(result.ide[0].targetDir).toBe(".vscode");
    });

    it("resolves IDE target dirs from platform registry", async () => {
        const profileDir = await createProfile("ide-multi", {
            "baton.profile.yaml": "name: ide-multi\nversion: 1.0.0\n",
            "ide/vscode/settings.json": "{}",
            "ide/jetbrains/codeStyles/Project.xml": "<xml/>",
            "ide/zed/settings.json": "{}",
        });

        const discovery = await discoverProfile(profileDir);
        const result = assembleContentFromDiscovery([{ discovery, meta: { name: "ide-multi" } }]);

        expect(result.ide).toHaveLength(3);
        const vscode = result.ide.find((i) => i.ideKey === "vscode");
        expect(vscode?.targetDir).toBe(".vscode");
        const jb = result.ide.find((i) => i.ideKey === "jetbrains");
        expect(jb?.targetDir).toBe(".idea");
        expect(jb?.fileName).toBe("codeStyles/Project.xml");
        const zed = result.ide.find((i) => i.ideKey === "zed");
        expect(zed?.targetDir).toBe(".config/zed");
    });

    it("warns and skips unknown IDE platforms", async () => {
        const profileDir = await createProfile("ide-unknown", {
            "baton.profile.yaml": "name: ide-unknown\nversion: 1.0.0\n",
            "ide/unknown-editor/config.json": "{}",
        });

        const discovery = await discoverProfile(profileDir);
        const result = assembleContentFromDiscovery([{ discovery, meta: { name: "ide-unknown" } }]);

        expect(result.ide).toHaveLength(0);
        expect(result.warnings.some((w) => w.includes("Unknown IDE platform"))).toBe(true);
        expect(result.warnings.some((w) => w.includes("unknown-editor"))).toBe(true);
    });

    it("deduplicates IDE files across profiles (last wins)", async () => {
        const baseDir = await createProfile("ide-base", {
            "baton.profile.yaml": "name: ide-base\nversion: 1.0.0\n",
            "ide/vscode/settings.json": "base settings",
        });
        const overrideDir = await createProfile("ide-override", {
            "baton.profile.yaml": "name: ide-override\nversion: 1.0.0\n",
            "ide/vscode/settings.json": "override settings",
        });

        const baseDisc = await discoverProfile(baseDir);
        const overrideDisc = await discoverProfile(overrideDir);

        const result = assembleContentFromDiscovery([
            { discovery: baseDisc, meta: { name: "ide-base" } },
            { discovery: overrideDisc, meta: { name: "ide-override" } },
        ]);

        expect(result.ide).toHaveLength(1);
        expect(result.ide[0].profileName).toBe("ide-override");
    });

    it("tracks sourceFilePaths for files and IDE entries", async () => {
        const profileDir = await createProfile("paths-files-ide", {
            "baton.profile.yaml": "name: paths-test\nversion: 1.0.0\n",
            "files/.editorconfig": "root = true",
            "ide/vscode/settings.json": "{}",
        });

        const discovery = await discoverProfile(profileDir);
        const result = assembleContentFromDiscovery([{ discovery, meta: { name: "paths-test" } }]);

        expect(result.sourceFilePaths.get("files/.editorconfig")).toBe(
            join(profileDir, "files", ".editorconfig"),
        );
        expect(result.sourceFilePaths.get("ide/vscode/settings.json")).toBe(
            join(profileDir, "ide", "vscode", "settings.json"),
        );
    });

    it("empty profile has empty files and ide arrays", async () => {
        const profileDir = await createProfile("empty-files-ide", {
            "baton.profile.yaml": "name: empty\nversion: 1.0.0\n",
        });

        const discovery = await discoverProfile(profileDir);
        const result = assembleContentFromDiscovery([{ discovery, meta: { name: "empty" } }]);

        expect(result.files).toHaveLength(0);
        expect(result.ide).toHaveLength(0);
    });
});
