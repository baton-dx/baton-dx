import type { Scope } from "@baton-dx/ai-tool-paths";
import { getIdePlatformTargetDir } from "../ide/platform-registry.js";
import type { AgentEntry } from "../merge/agents.js";
import type { MemoryContribution, MemoryEntry } from "../merge/memory.js";
import type { RuleEntry } from "../merge/rules.js";
import { resolveScope } from "../merge/scope-resolution.js";
import type { MergedSkillItem } from "../merge/skills.js";
import type { MergeStrategy } from "../schemas/profile-manifest.js";
import type { ProfileDiscoveryResult } from "./types.js";

/**
 * Metadata for a profile in the discovery-based assembly path.
 * Maps 1:1 with a profile in the weight-sorted chain.
 */
export interface DiscoveryProfileMeta {
    /** Profile name (used for attribution) */
    name: string;
    /** Profile-level scope from manifest (undefined = "project") */
    profileScope?: Scope;
}

/**
 * A single profile's discovery result paired with its metadata.
 */
export interface DiscoveryInput {
    discovery: ProfileDiscoveryResult;
    meta: DiscoveryProfileMeta;
}

/**
 * Output of discovery-based content assembly.
 * Matches the shapes produced by the manifest-based merge functions.
 */
export interface AssembledContent {
    rules: RuleEntry[];
    agents: AgentEntry[];
    skills: MergedSkillItem[];
    memory: MemoryEntry[];
    commands: CommandEntry[];
    files: FileEntry[];
    ide: IdeEntry[];
    warnings: string[];
    /**
     * Maps canonical keys ("rules/<name>", "agents/<name>") to absolute source file paths.
     * Discovery scans flat directories (ai/rules/*.md), but the manifest path expects
     * subdirectory structure (ai/rules/universal/<name>.md). This map lets the sync
     * pipeline read from the correct location when using the discovery path.
     */
    sourceFilePaths: Map<string, string>;
}

/**
 * A command entry produced by discovery assembly.
 * Commands in the manifest path are tracked as Map<name, profileName>.
 */
export interface CommandEntry {
    name: string;
    profileName: string;
    scope: Scope;
}

/** A file entry from the profile's files/ directory. */
export interface FileEntry {
    /** Relative path within files/ dir (same as target) */
    source: string;
    /** Target path relative to project root */
    target: string;
    profileName: string;
}

/** An IDE config file entry from the profile's ide/ directory. */
export interface IdeEntry {
    /** IDE platform key (e.g. "vscode") */
    ideKey: string;
    /** Relative path within the platform directory */
    fileName: string;
    /** Project target dir from registry (e.g. ".vscode") */
    targetDir: string;
    profileName: string;
}

const VALID_MERGE_STRATEGIES: readonly string[] = ["concat", "replace"];

function toMergeStrategy(value: string): MergeStrategy {
    if (VALID_MERGE_STRATEGIES.includes(value)) {
        return value as MergeStrategy;
    }
    return "concat";
}

/** Merge a single profile's memory into the accumulator map. */
function assembleMemory(
    memoryMap: Map<string, MemoryEntry>,
    discovery: ProfileDiscoveryResult,
    meta: DiscoveryProfileMeta,
): void {
    if (!discovery.memory) return;

    const mem = discovery.memory;
    const scope = resolveScope(mem.scope, meta.profileScope);
    const mergeStrategy = toMergeStrategy(mem.merge);
    const contribution: MemoryContribution = {
        profileName: meta.name,
        mergeStrategy,
    };

    const existing = memoryMap.get("MEMORY.md");
    if (existing) {
        // Avoid duplicate contributions from same profile
        if (!existing.contributions.some((c) => c.profileName === meta.name)) {
            existing.contributions.push(contribution);
        }
        // Last profile wins on strategy and scope
        existing.mergeStrategy = mergeStrategy;
        existing.scope = scope;
    } else {
        memoryMap.set("MEMORY.md", {
            filename: "MEMORY.md",
            mergeStrategy,
            scope,
            contributions: [contribution],
        });
    }
}

/** Merge a single profile's files into the accumulator map. */
function assembleFiles(
    fileMap: Map<string, FileEntry>,
    sourceFilePaths: Map<string, string>,
    discovery: ProfileDiscoveryResult,
    meta: DiscoveryProfileMeta,
): void {
    for (const file of discovery.files) {
        fileMap.set(file.targetRelative, {
            source: file.targetRelative,
            target: file.targetRelative,
            profileName: meta.name,
        });
        sourceFilePaths.set(`files/${file.targetRelative}`, file.sourcePath);
    }
}

/** Merge a single profile's IDE configs into the accumulator map. */
function assembleIde(
    ideMap: Map<string, IdeEntry>,
    sourceFilePaths: Map<string, string>,
    warnings: string[],
    discovery: ProfileDiscoveryResult,
    meta: DiscoveryProfileMeta,
): void {
    for (const ide of discovery.ide) {
        const targetDir = getIdePlatformTargetDir(ide.platform);
        if (!targetDir) {
            warnings.push(
                `Unknown IDE platform "${ide.platform}" in profile "${meta.name}" — skipping ${ide.targetRelative}`,
            );
            continue;
        }
        ideMap.set(`${targetDir}/${ide.targetRelative}`, {
            ideKey: ide.platform,
            fileName: ide.targetRelative,
            targetDir,
            profileName: meta.name,
        });
        sourceFilePaths.set(`ide/${ide.platform}/${ide.targetRelative}`, ide.sourcePath);
    }
}

/**
 * Assemble content from filesystem discovery results into merge-compatible structures.
 *
 * This is the discovery-path counterpart to the manifest-based merge functions
 * (mergeRules, mergeAgents, mergeSkills, mergeMemory). It converts
 * `ProfileDiscoveryResult[]` into the same output types the sync pipeline expects.
 *
 * Deduplication: last profile wins (profiles are expected in weight-sorted order,
 * base first, overrides last — same as manifest merge functions).
 *
 * @param inputs - Discovery results paired with profile metadata, in merge order
 * @returns Assembled content ready for the sync pipeline
 */
export function assembleContentFromDiscovery(inputs: DiscoveryInput[]): AssembledContent {
    const ruleMap = new Map<string, RuleEntry>();
    const agentMap = new Map<string, AgentEntry>();
    const skillMap = new Map<string, MergedSkillItem>();
    const memoryMap = new Map<string, MemoryEntry>();
    const commandMap = new Map<string, CommandEntry>();
    const fileMap = new Map<string, FileEntry>();
    const ideMap = new Map<string, IdeEntry>();
    const sourceFilePaths = new Map<string, string>();
    const warnings: string[] = [];

    for (const { discovery, meta } of inputs) {
        warnings.push(...discovery.warnings);

        for (const rule of discovery.rules) {
            ruleMap.set(rule.name, {
                name: rule.name,
                agents: [],
                scope: resolveScope(rule.scope, meta.profileScope),
                profileName: meta.name,
            });
            sourceFilePaths.set(`rules/${rule.name}`, rule.filePath);
        }

        for (const agent of discovery.agents) {
            agentMap.set(agent.name, {
                name: agent.name,
                agents: [],
                scope: resolveScope(agent.scope, meta.profileScope),
                profileName: meta.name,
            });
            sourceFilePaths.set(`agents/${agent.name}`, agent.filePath);
        }

        for (const skill of discovery.skills) {
            skillMap.set(skill.name, {
                name: skill.name,
                scope: resolveScope(skill.scope, meta.profileScope),
                profileName: meta.name,
            });
            sourceFilePaths.set(`skills/${skill.name}`, skill.dirPath);
        }

        assembleMemory(memoryMap, discovery, meta);

        for (const cmd of discovery.commands) {
            commandMap.set(cmd.name, {
                name: cmd.name,
                profileName: meta.name,
                scope: resolveScope(cmd.scope, meta.profileScope),
            });
            sourceFilePaths.set(`commands/${cmd.name}`, cmd.filePath);
        }

        assembleFiles(fileMap, sourceFilePaths, discovery, meta);
        assembleIde(ideMap, sourceFilePaths, warnings, discovery, meta);
    }

    return {
        rules: Array.from(ruleMap.values()),
        agents: Array.from(agentMap.values()),
        skills: Array.from(skillMap.values()),
        memory: Array.from(memoryMap.values()),
        commands: Array.from(commandMap.values()),
        files: Array.from(fileMap.values()),
        ide: Array.from(ideMap.values()),
        sourceFilePaths,
        warnings,
    };
}
