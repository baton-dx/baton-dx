import type { Scope } from "@baton-dx/ai-tool-paths";

export interface DiscoveredMemory {
    type: "memory";
    /** Absolute path to MEMORY.md */
    filePath: string;
    /** Raw content including frontmatter */
    content: string;
    /** Merge strategy from frontmatter (default: "concat") */
    merge: string;
    /** Scope from frontmatter (undefined = inherit from profile) */
    scope?: Scope;
}

export interface DiscoveredRule {
    type: "rule";
    /** Rule name (filename without .md) */
    name: string;
    filePath: string;
    content: string;
    scope?: Scope;
}

export interface DiscoveredAgent {
    type: "agent";
    name: string;
    filePath: string;
    content: string;
    scope?: Scope;
}

export interface DiscoveredSkill {
    type: "skill";
    /** Skill name (directory name) */
    name: string;
    /** Absolute path to skill directory */
    dirPath: string;
    /** Absolute path to SKILL.md */
    skillMdPath: string;
    content: string;
    scope?: Scope;
}

export interface DiscoveredCommand {
    type: "command";
    name: string;
    filePath: string;
    content: string;
    scope?: Scope;
}

export interface DiscoveredMcpServer {
    type: "mcp";
    /** Server name (filename without .yaml) */
    name: string;
    filePath: string;
    /** Parsed YAML config */
    config: Record<string, unknown>;
}

export interface DiscoveredFile {
    type: "file";
    /** Source path (absolute) */
    sourcePath: string;
    /** Target path (relative, from directory structure) */
    targetRelative: string;
}

export interface DiscoveredIdeFile {
    type: "ide";
    /** IDE platform key (directory name) */
    platform: string;
    sourcePath: string;
    /** Relative path within the platform directory */
    targetRelative: string;
}

/** Complete discovery result for a profile directory. */
export interface ProfileDiscoveryResult {
    memory?: DiscoveredMemory;
    rules: DiscoveredRule[];
    agents: DiscoveredAgent[];
    skills: DiscoveredSkill[];
    commands: DiscoveredCommand[];
    mcp: DiscoveredMcpServer[];
    files: DiscoveredFile[];
    ide: DiscoveredIdeFile[];
    warnings: string[];
}
