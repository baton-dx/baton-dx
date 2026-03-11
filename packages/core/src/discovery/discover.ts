import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import type { Scope } from "@baton-dx/ai-tool-paths";
import { parse as parseYaml } from "yaml";
import { parseFrontmatter } from "../frontmatter/parser.js";
import type {
    DiscoveredAgent,
    DiscoveredCommand,
    DiscoveredFile,
    DiscoveredIdeFile,
    DiscoveredMcpServer,
    DiscoveredMemory,
    DiscoveredRule,
    DiscoveredSkill,
    ProfileDiscoveryResult,
} from "./types.js";

function isScope(value: unknown): value is Scope {
    return value === "project" || value === "global";
}

async function dirExists(path: string): Promise<boolean> {
    try {
        const s = await stat(path);
        return s.isDirectory();
    } catch {
        return false;
    }
}

async function discoverMemory(
    profileDir: string,
    warnings: string[],
): Promise<DiscoveredMemory | undefined> {
    const memoryDir = join(profileDir, "ai", "memory");
    if (!(await dirExists(memoryDir))) return undefined;

    const memoryPath = join(memoryDir, "MEMORY.md");
    try {
        const content = await readFile(memoryPath, "utf-8");
        const parsed = parseFrontmatter(content);
        const merge =
            typeof parsed.batonMetadata.merge === "string" ? parsed.batonMetadata.merge : "append";
        const scope = isScope(parsed.batonMetadata.scope) ? parsed.batonMetadata.scope : undefined;

        return { type: "memory", filePath: memoryPath, content, merge, scope };
    } catch {
        warnings.push(`ai/memory/ exists but no MEMORY.md found in ${memoryDir}`);
        return undefined;
    }
}

async function discoverMdFiles<T extends "rule" | "agent" | "command">(
    profileDir: string,
    subDir: string,
    type: T,
): Promise<
    Array<{
        type: T;
        name: string;
        filePath: string;
        content: string;
        scope?: Scope;
    }>
> {
    const dir = join(profileDir, "ai", subDir);
    if (!(await dirExists(dir))) return [];

    const entries = await readdir(dir, { withFileTypes: true });
    const results: Array<{
        type: T;
        name: string;
        filePath: string;
        content: string;
        scope?: Scope;
    }> = [];

    for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (entry.name.startsWith("_")) continue;
        if (!entry.name.endsWith(".md")) continue;

        const filePath = join(dir, entry.name);
        const content = await readFile(filePath, "utf-8");
        const parsed = parseFrontmatter(content);
        const scope = isScope(parsed.batonMetadata.scope) ? parsed.batonMetadata.scope : undefined;
        const name = entry.name.replace(/\.md$/, "");

        results.push({ type, name, filePath, content, scope });
    }

    return results;
}

async function discoverRules(profileDir: string): Promise<DiscoveredRule[]> {
    return discoverMdFiles(profileDir, "rules", "rule");
}

async function discoverAgents(profileDir: string): Promise<DiscoveredAgent[]> {
    return discoverMdFiles(profileDir, "agents", "agent");
}

async function discoverCommands(profileDir: string): Promise<DiscoveredCommand[]> {
    return discoverMdFiles(profileDir, "commands", "command");
}

async function discoverSkills(profileDir: string, warnings: string[]): Promise<DiscoveredSkill[]> {
    const skillsDir = join(profileDir, "ai", "skills");
    if (!(await dirExists(skillsDir))) return [];

    const entries = await readdir(skillsDir, { withFileTypes: true });
    const results: DiscoveredSkill[] = [];

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith("_")) continue;

        const dirPath = join(skillsDir, entry.name);
        const skillMdPath = join(dirPath, "SKILL.md");

        try {
            const content = await readFile(skillMdPath, "utf-8");
            const parsed = parseFrontmatter(content);
            const scope = isScope(parsed.batonMetadata.scope)
                ? parsed.batonMetadata.scope
                : undefined;

            results.push({
                type: "skill",
                name: entry.name,
                dirPath,
                skillMdPath,
                content,
                scope,
            });
        } catch {
            warnings.push(`ai/skills/${entry.name}/ exists but no SKILL.md found`);
        }
    }

    return results;
}

async function discoverMcp(profileDir: string, warnings: string[]): Promise<DiscoveredMcpServer[]> {
    const mcpDir = join(profileDir, "ai", "mcp");
    if (!(await dirExists(mcpDir))) return [];

    const entries = await readdir(mcpDir, { withFileTypes: true });
    const results: DiscoveredMcpServer[] = [];

    for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (entry.name.startsWith("_")) continue;
        if (!entry.name.endsWith(".yaml")) continue;

        const filePath = join(mcpDir, entry.name);
        const raw = await readFile(filePath, "utf-8");
        const name = entry.name.replace(/\.yaml$/, "");

        try {
            const config = parseYaml(raw) as Record<string, unknown>;
            results.push({ type: "mcp", name, filePath, config });
        } catch {
            warnings.push(`ai/mcp/${entry.name} contains invalid YAML — skipping`);
        }
    }

    return results;
}

async function collectFiles(
    baseDir: string,
    currentDir: string,
    excludeUnderscore: boolean,
): Promise<Array<{ sourcePath: string; targetRelative: string }>> {
    const entries = await readdir(currentDir, { withFileTypes: true });
    const results: Array<{ sourcePath: string; targetRelative: string }> = [];

    for (const entry of entries) {
        if (excludeUnderscore && entry.name.startsWith("_")) continue;

        const fullPath = join(currentDir, entry.name);

        if (entry.isDirectory()) {
            const nested = await collectFiles(baseDir, fullPath, excludeUnderscore);
            results.push(...nested);
        } else if (entry.isFile()) {
            results.push({
                sourcePath: fullPath,
                targetRelative: relative(baseDir, fullPath),
            });
        }
    }

    return results;
}

async function discoverFiles(profileDir: string): Promise<DiscoveredFile[]> {
    const filesDir = join(profileDir, "files");
    if (!(await dirExists(filesDir))) return [];

    const collected = await collectFiles(filesDir, filesDir, true);
    return collected.map((f) => ({
        type: "file" as const,
        sourcePath: f.sourcePath,
        targetRelative: f.targetRelative,
    }));
}

async function discoverIde(profileDir: string): Promise<DiscoveredIdeFile[]> {
    const ideDir = join(profileDir, "ide");
    if (!(await dirExists(ideDir))) return [];

    const platforms = await readdir(ideDir, { withFileTypes: true });
    const results: DiscoveredIdeFile[] = [];

    for (const platform of platforms) {
        if (!platform.isDirectory()) continue;
        if (platform.name.startsWith("_")) continue;

        const platformDir = join(ideDir, platform.name);
        const collected = await collectFiles(platformDir, platformDir, true);

        for (const f of collected) {
            results.push({
                type: "ide",
                platform: platform.name,
                sourcePath: f.sourcePath,
                targetRelative: f.targetRelative,
            });
        }
    }

    return results;
}

export async function discoverProfile(profileDir: string): Promise<ProfileDiscoveryResult> {
    const warnings: string[] = [];

    const [memory, rules, agents, skills, commands, mcp, files, ide] = await Promise.all([
        discoverMemory(profileDir, warnings),
        discoverRules(profileDir),
        discoverAgents(profileDir),
        discoverSkills(profileDir, warnings),
        discoverCommands(profileDir),
        discoverMcp(profileDir, warnings),
        discoverFiles(profileDir),
        discoverIde(profileDir),
    ]);

    return { memory, rules, agents, skills, commands, mcp, files, ide, warnings };
}
