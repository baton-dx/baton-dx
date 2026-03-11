import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discoverProfile } from "./discover.js";

describe("discoverProfile", () => {
    let profileDir: string;

    beforeEach(async () => {
        profileDir = await mkdtemp(join(tmpdir(), "baton-discover-"));
    });

    afterEach(async () => {
        await rm(profileDir, { recursive: true, force: true });
    });

    // --- Empty / missing directories ---

    it("returns empty arrays for an empty profile directory", async () => {
        const result = await discoverProfile(profileDir);
        expect(result.memory).toBeUndefined();
        expect(result.rules).toEqual([]);
        expect(result.agents).toEqual([]);
        expect(result.skills).toEqual([]);
        expect(result.commands).toEqual([]);
        expect(result.mcp).toEqual([]);
        expect(result.files).toEqual([]);
        expect(result.ide).toEqual([]);
        expect(result.warnings).toEqual([]);
    });

    // --- Memory ---

    it("discovers MEMORY.md from ai/memory/", async () => {
        const memoryDir = join(profileDir, "ai", "memory");
        await mkdir(memoryDir, { recursive: true });
        const content = "---\nmerge: append\nscope: global\n---\nShared memory content";
        await writeFile(join(memoryDir, "MEMORY.md"), content);

        const result = await discoverProfile(profileDir);
        expect(result.memory).toBeDefined();
        expect(result.memory!.type).toBe("memory");
        expect(result.memory!.filePath).toBe(join(memoryDir, "MEMORY.md"));
        expect(result.memory!.content).toBe(content);
        expect(result.memory!.merge).toBe("append");
        expect(result.memory!.scope).toBe("global");
    });

    it("defaults merge to 'concat' when not in frontmatter", async () => {
        const memoryDir = join(profileDir, "ai", "memory");
        await mkdir(memoryDir, { recursive: true });
        await writeFile(join(memoryDir, "MEMORY.md"), "Just some memory content");

        const result = await discoverProfile(profileDir);
        expect(result.memory).toBeDefined();
        expect(result.memory!.merge).toBe("concat");
        expect(result.memory!.scope).toBeUndefined();
    });

    it("warns when ai/memory/ exists but no MEMORY.md", async () => {
        const memoryDir = join(profileDir, "ai", "memory");
        await mkdir(memoryDir, { recursive: true });
        await writeFile(join(memoryDir, "notes.txt"), "not a memory file");

        const result = await discoverProfile(profileDir);
        expect(result.memory).toBeUndefined();
        expect(result.warnings).toContainEqual(expect.stringContaining("MEMORY.md"));
    });

    // --- Rules ---

    it("discovers .md rules from ai/rules/", async () => {
        const rulesDir = join(profileDir, "ai", "rules");
        await mkdir(rulesDir, { recursive: true });
        await writeFile(join(rulesDir, "style-guide.md"), "---\nscope: project\n---\nUse tabs.");
        await writeFile(join(rulesDir, "naming.md"), "Use camelCase.");

        const result = await discoverProfile(profileDir);
        expect(result.rules).toHaveLength(2);

        const style = result.rules.find((r) => r.name === "style-guide");
        expect(style).toBeDefined();
        expect(style!.type).toBe("rule");
        expect(style!.scope).toBe("project");
        expect(style!.content).toBe("---\nscope: project\n---\nUse tabs.");

        const naming = result.rules.find((r) => r.name === "naming");
        expect(naming).toBeDefined();
        expect(naming!.scope).toBeUndefined();
    });

    it("ignores non-.md files in ai/rules/", async () => {
        const rulesDir = join(profileDir, "ai", "rules");
        await mkdir(rulesDir, { recursive: true });
        await writeFile(join(rulesDir, "valid.md"), "A rule");
        await writeFile(join(rulesDir, "notes.txt"), "Not a rule");
        await writeFile(join(rulesDir, "data.json"), "{}");

        const result = await discoverProfile(profileDir);
        expect(result.rules).toHaveLength(1);
        expect(result.rules[0].name).toBe("valid");
    });

    // --- Agents ---

    it("discovers .md agents from ai/agents/", async () => {
        const agentsDir = join(profileDir, "ai", "agents");
        await mkdir(agentsDir, { recursive: true });
        await writeFile(
            join(agentsDir, "reviewer.md"),
            "---\nscope: global\n---\nReview PRs carefully.",
        );

        const result = await discoverProfile(profileDir);
        expect(result.agents).toHaveLength(1);
        expect(result.agents[0].type).toBe("agent");
        expect(result.agents[0].name).toBe("reviewer");
        expect(result.agents[0].scope).toBe("global");
    });

    // --- Skills ---

    it("discovers skill directories from ai/skills/*/SKILL.md", async () => {
        const skillDir = join(profileDir, "ai", "skills", "debugging");
        await mkdir(skillDir, { recursive: true });
        const content = "---\nscope: project\n---\n# Debugging Skill\nSteps...";
        await writeFile(join(skillDir, "SKILL.md"), content);

        const result = await discoverProfile(profileDir);
        expect(result.skills).toHaveLength(1);
        expect(result.skills[0].type).toBe("skill");
        expect(result.skills[0].name).toBe("debugging");
        expect(result.skills[0].dirPath).toBe(skillDir);
        expect(result.skills[0].skillMdPath).toBe(join(skillDir, "SKILL.md"));
        expect(result.skills[0].content).toBe(content);
        expect(result.skills[0].scope).toBe("project");
    });

    it("warns when ai/skills/foo/ exists but no SKILL.md", async () => {
        const skillDir = join(profileDir, "ai", "skills", "broken");
        await mkdir(skillDir, { recursive: true });
        await writeFile(join(skillDir, "readme.txt"), "not a skill");

        const result = await discoverProfile(profileDir);
        expect(result.skills).toHaveLength(0);
        expect(result.warnings).toContainEqual(expect.stringContaining("SKILL.md"));
        expect(result.warnings).toContainEqual(expect.stringContaining("broken"));
    });

    // --- Commands ---

    it("discovers .md commands from ai/commands/", async () => {
        const commandsDir = join(profileDir, "ai", "commands");
        await mkdir(commandsDir, { recursive: true });
        await writeFile(join(commandsDir, "deploy.md"), "Run deploy steps.");

        const result = await discoverProfile(profileDir);
        expect(result.commands).toHaveLength(1);
        expect(result.commands[0].type).toBe("command");
        expect(result.commands[0].name).toBe("deploy");
        expect(result.commands[0].content).toBe("Run deploy steps.");
    });

    // --- MCP ---

    it("discovers .yaml MCP servers from ai/mcp/", async () => {
        const mcpDir = join(profileDir, "ai", "mcp");
        await mkdir(mcpDir, { recursive: true });
        const yamlContent = "command: npx\nargs:\n  - -y\n  - some-server";
        await writeFile(join(mcpDir, "my-server.yaml"), yamlContent);

        const result = await discoverProfile(profileDir);
        expect(result.mcp).toHaveLength(1);
        expect(result.mcp[0].type).toBe("mcp");
        expect(result.mcp[0].name).toBe("my-server");
        expect(result.mcp[0].config).toEqual({
            command: "npx",
            args: ["-y", "some-server"],
        });
    });

    it("ignores non-.yaml files in ai/mcp/", async () => {
        const mcpDir = join(profileDir, "ai", "mcp");
        await mkdir(mcpDir, { recursive: true });
        await writeFile(join(mcpDir, "valid.yaml"), "command: node");
        await writeFile(join(mcpDir, "notes.md"), "not yaml");
        await writeFile(join(mcpDir, "config.json"), "{}");

        const result = await discoverProfile(profileDir);
        expect(result.mcp).toHaveLength(1);
        expect(result.mcp[0].name).toBe("valid");
    });

    it("warns on malformed MCP YAML and skips the file", async () => {
        const mcpDir = join(profileDir, "ai", "mcp");
        await mkdir(mcpDir, { recursive: true });
        await writeFile(join(mcpDir, "broken.yaml"), ": invalid: yaml: {{");

        const result = await discoverProfile(profileDir);
        expect(result.mcp).toHaveLength(0);
        expect(result.warnings).toContainEqual(expect.stringContaining("broken.yaml"));
        expect(result.warnings).toContainEqual(expect.stringContaining("invalid YAML"));
    });

    // --- Files ---

    it("discovers files from files/ with directory structure as target", async () => {
        const filesDir = join(profileDir, "files");
        await mkdir(join(filesDir, "config", "sub"), { recursive: true });
        await writeFile(join(filesDir, "root.txt"), "root file");
        await writeFile(join(filesDir, "config", "sub", "deep.json"), "{}");

        const result = await discoverProfile(profileDir);
        expect(result.files).toHaveLength(2);

        const rootFile = result.files.find((f) => f.targetRelative === "root.txt");
        expect(rootFile).toBeDefined();
        expect(rootFile!.type).toBe("file");
        expect(rootFile!.sourcePath).toBe(join(filesDir, "root.txt"));

        const deepFile = result.files.find((f) => f.targetRelative === "config/sub/deep.json");
        expect(deepFile).toBeDefined();
        expect(deepFile!.sourcePath).toBe(join(filesDir, "config", "sub", "deep.json"));
    });

    // --- IDE ---

    it("discovers IDE files from ide/{platform}/", async () => {
        const vscodeDir = join(profileDir, "ide", "vscode");
        await mkdir(join(vscodeDir, "snippets"), { recursive: true });
        await writeFile(join(vscodeDir, "settings.json"), '{ "editor.tabSize": 2 }');
        await writeFile(join(vscodeDir, "snippets", "ts.json"), '{ "prefix": "log" }');

        const result = await discoverProfile(profileDir);
        expect(result.ide).toHaveLength(2);

        const settings = result.ide.find((f) => f.targetRelative === "settings.json");
        expect(settings).toBeDefined();
        expect(settings!.type).toBe("ide");
        expect(settings!.platform).toBe("vscode");
        expect(settings!.sourcePath).toBe(join(vscodeDir, "settings.json"));

        const snippet = result.ide.find((f) => f.targetRelative === "snippets/ts.json");
        expect(snippet).toBeDefined();
        expect(snippet!.platform).toBe("vscode");
    });

    // --- Underscore exclusion ---

    it("ignores files starting with _ in all directories", async () => {
        const rulesDir = join(profileDir, "ai", "rules");
        const agentsDir = join(profileDir, "ai", "agents");
        const commandsDir = join(profileDir, "ai", "commands");
        const mcpDir = join(profileDir, "ai", "mcp");
        const filesDir = join(profileDir, "files");

        await mkdir(rulesDir, { recursive: true });
        await mkdir(agentsDir, { recursive: true });
        await mkdir(commandsDir, { recursive: true });
        await mkdir(mcpDir, { recursive: true });
        await mkdir(filesDir, { recursive: true });

        await writeFile(join(rulesDir, "_draft.md"), "Draft rule");
        await writeFile(join(rulesDir, "active.md"), "Active rule");
        await writeFile(join(agentsDir, "_wip.md"), "WIP agent");
        await writeFile(join(commandsDir, "_disabled.md"), "Disabled");
        await writeFile(join(mcpDir, "_testing.yaml"), "command: test");
        await writeFile(join(filesDir, "_hidden.txt"), "hidden");

        const result = await discoverProfile(profileDir);
        expect(result.rules).toHaveLength(1);
        expect(result.rules[0].name).toBe("active");
        expect(result.agents).toHaveLength(0);
        expect(result.commands).toHaveLength(0);
        expect(result.mcp).toHaveLength(0);
        expect(result.files).toHaveLength(0);
    });

    it("ignores skill directories starting with _", async () => {
        const skillsDir = join(profileDir, "ai", "skills");
        const activeSkill = join(skillsDir, "active-skill");
        const draftSkill = join(skillsDir, "_draft-skill");

        await mkdir(activeSkill, { recursive: true });
        await mkdir(draftSkill, { recursive: true });
        await writeFile(join(activeSkill, "SKILL.md"), "Active skill");
        await writeFile(join(draftSkill, "SKILL.md"), "Draft skill");

        const result = await discoverProfile(profileDir);
        expect(result.skills).toHaveLength(1);
        expect(result.skills[0].name).toBe("active-skill");
    });

    // --- Multiple content types together ---

    it("discovers all content types in a full profile", async () => {
        // Set up all directories
        await mkdir(join(profileDir, "ai", "memory"), { recursive: true });
        await mkdir(join(profileDir, "ai", "rules"), { recursive: true });
        await mkdir(join(profileDir, "ai", "agents"), { recursive: true });
        await mkdir(join(profileDir, "ai", "skills", "testing"), {
            recursive: true,
        });
        await mkdir(join(profileDir, "ai", "commands"), { recursive: true });
        await mkdir(join(profileDir, "ai", "mcp"), { recursive: true });
        await mkdir(join(profileDir, "files"), { recursive: true });
        await mkdir(join(profileDir, "ide", "vscode"), { recursive: true });

        await writeFile(join(profileDir, "ai", "memory", "MEMORY.md"), "Memory content");
        await writeFile(join(profileDir, "ai", "rules", "lint.md"), "Lint rules");
        await writeFile(join(profileDir, "ai", "agents", "helper.md"), "Helper agent");
        await writeFile(join(profileDir, "ai", "skills", "testing", "SKILL.md"), "Testing skill");
        await writeFile(join(profileDir, "ai", "commands", "build.md"), "Build command");
        await writeFile(join(profileDir, "ai", "mcp", "db.yaml"), "command: db-server");
        await writeFile(join(profileDir, "files", "config.toml"), "[section]");
        await writeFile(join(profileDir, "ide", "vscode", "ext.json"), "{}");

        const result = await discoverProfile(profileDir);
        expect(result.memory).toBeDefined();
        expect(result.rules).toHaveLength(1);
        expect(result.agents).toHaveLength(1);
        expect(result.skills).toHaveLength(1);
        expect(result.commands).toHaveLength(1);
        expect(result.mcp).toHaveLength(1);
        expect(result.files).toHaveLength(1);
        expect(result.ide).toHaveLength(1);
        expect(result.warnings).toEqual([]);
    });
});
