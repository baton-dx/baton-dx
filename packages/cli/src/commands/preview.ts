import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { AIToolAdapter } from "@baton-dx/core";
import {
    assembleContentFromDiscovery,
    type ClonedSource,
    cloneGitSource,
    type DirectiveContext,
    detectInstalledAITools,
    discoverProfile,
    expandLocalPath,
    getAIToolAdaptersForKeys,
    getAuthenticatedUrl,
    getAuthSetupInstructions,
    getGlobalAiTools,
    getGlobalIdePlatforms,
    loadProfileManifest,
    loadProjectManifest,
    type MemoryEntry,
    type MergedSkillItem,
    mergeContentParts,
    normalizeMarkdown,
    parseFrontmatter,
    parseSource,
    processDirectives,
    type RuleEntry,
    type RuleFile,
    resolveAuth,
    resolveNpmSource,
    resolveProfileChain,
    resolveScope,
    type Scope,
    sortProfilesByWeight,
} from "@baton-dx/core";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { buildIntersection } from "../utils/build-intersection.js";
import { pc } from "../utils/output.js";

const VALID_TYPES = ["memory", "rules", "agents", "skills", "commands"] as const;
type ContentType = (typeof VALID_TYPES)[number];

/** A single rendered output section */
interface PreviewSection {
    filePath: string;
    content: string;
}

export const previewCommand = defineCommand({
    meta: {
        name: "preview",
        description: "Preview processed output for a specific AI tool, with directive processing",
    },
    args: {
        tool: {
            type: "string",
            description: 'AI tool key (e.g. "claude-code", "cursor")',
            required: true,
        },
        type: {
            type: "string",
            description: "Filter to a content type: memory, rules, agents, skills, commands",
        },
        diff: {
            type: "string",
            description: "Compare output with another tool (e.g. --diff cursor)",
        },
    },
    async run({ args }) {
        p.intro("Baton Preview");

        try {
            const typeFilter = args.type as ContentType | undefined;
            if (typeFilter && !VALID_TYPES.includes(typeFilter)) {
                p.cancel(
                    `Invalid --type "${typeFilter}". Must be one of: ${VALID_TYPES.join(", ")}`,
                );
                process.exit(1);
            }

            const projectRoot = process.cwd();
            const manifestPath = resolve(projectRoot, "baton.yaml");
            const manifest = await loadProjectManifest(manifestPath);

            if (!manifest.profiles || manifest.profiles.length === 0) {
                p.outro("No profiles configured in baton.yaml");
                process.exit(0);
            }

            // Step 1: Resolve profile chains
            const spinner = p.spinner();
            spinner.start("Resolving profile chain...");

            const allProfiles = [];
            const profileLocalPaths = new Map<string, string>();
            const resolutionErrors: string[] = [];

            for (const profileSource of manifest.profiles) {
                try {
                    const parsed = parseSource(profileSource.source);

                    let profileManifestPath: string;
                    let localPath: string;

                    if (parsed.provider === "local" || parsed.provider === "file") {
                        localPath = expandLocalPath(parsed.path, projectRoot);
                        profileManifestPath = resolve(localPath, "baton.profile.yaml");
                    } else if (parsed.provider === "npm") {
                        const resolved = await resolveNpmSource({
                            source: parsed,
                            basePath: projectRoot,
                            useCache: false,
                        });
                        localPath = resolved.localPath;
                        profileManifestPath = resolve(resolved.localPath, "baton.profile.yaml");
                    } else {
                        const url = parsed.url;
                        const subpath =
                            parsed.provider === "github" || parsed.provider === "gitlab"
                                ? parsed.subpath
                                : undefined;

                        const hostname = new URL(url).hostname;
                        const auth = await resolveAuth(hostname);
                        if (auth.method === "none") {
                            spinner.message(
                                `Skipping ${profileSource.source}: ${getAuthSetupInstructions(hostname, auth.triedMethods)}`,
                            );
                            continue;
                        }
                        const cloneUrl = await getAuthenticatedUrl(url, auth);

                        const cloned: ClonedSource = await cloneGitSource({
                            url: cloneUrl,
                            ref: profileSource.version || undefined,
                            subpath,
                            useCache: false,
                            authToken: auth.token,
                        });
                        localPath = cloned.localPath;
                        profileManifestPath = resolve(cloned.localPath, "baton.profile.yaml");
                    }

                    const profileManifest = await loadProfileManifest(profileManifestPath);
                    const profileDir = dirname(profileManifestPath);
                    const chain = await resolveProfileChain(
                        profileManifest,
                        profileSource.source,
                        profileDir,
                    );

                    for (const prof of chain) {
                        profileLocalPaths.set(prof.name, prof.localPath ?? localPath);
                    }
                    allProfiles.push(...chain);
                } catch (error) {
                    resolutionErrors.push(
                        `Failed to resolve ${profileSource.source}: ${error instanceof Error ? error.message : error}`,
                    );
                }
            }

            if (allProfiles.length === 0) {
                spinner.stop("No profiles resolved");
                for (const err of resolutionErrors) {
                    p.log.error(err);
                }
                p.outro("Nothing to preview. Run `baton manage` to add a profile.");
                process.exit(0);
            }

            spinner.stop(`Resolved ${allProfiles.length} profile(s)`);

            // Step 2: Discover and assemble content using filesystem discovery
            spinner.start("Discovering and merging configurations...");

            const weightSortedProfiles = sortProfilesByWeight(allProfiles);

            const discoveryInputs = [];
            for (const profile of weightSortedProfiles) {
                const localPath = profileLocalPaths.get(profile.name);
                if (!localPath) continue;
                try {
                    const discovery = await discoverProfile(localPath);
                    discoveryInputs.push({
                        discovery,
                        meta: {
                            name: profile.name,
                            profileScope: profile.manifest.scope,
                        },
                    });
                } catch {
                    // Skip profiles where discovery fails
                }
            }

            const assembled = assembleContentFromDiscovery(discoveryInputs);
            const mergedSkills: MergedSkillItem[] = assembled.skills;
            const mergedRules: RuleEntry[] = assembled.rules;
            const mergedAgents = assembled.agents;
            const mergedMemory: MemoryEntry[] = assembled.memory;
            const mergedCommands = assembled.commands;
            const sourceFilePaths = assembled.sourceFilePaths;

            spinner.stop("Configurations merged");

            // Step 3: Compute tool intersection, find matching adapters
            spinner.start("Computing tool intersection...");

            const globalAiTools = await getGlobalAiTools();
            const detectedAITools = await detectInstalledAITools();

            let syncedAiTools: string[];
            if (globalAiTools.length > 0) {
                const developerTools = {
                    aiTools: globalAiTools,
                    idePlatforms: await getGlobalIdePlatforms(),
                };
                const aggregatedSyncedAi = new Set<string>();
                for (const profileSource of manifest.profiles) {
                    try {
                        const intersection = await buildIntersection(
                            profileSource.source,
                            developerTools,
                            projectRoot,
                        );
                        if (intersection) {
                            for (const tool of intersection.aiTools.synced)
                                aggregatedSyncedAi.add(tool);
                        }
                    } catch {
                        /* skip */
                    }
                }
                syncedAiTools = aggregatedSyncedAi.size > 0 ? [...aggregatedSyncedAi] : [];
            } else {
                syncedAiTools = detectedAITools;
            }

            if (syncedAiTools.length === 0) {
                spinner.stop("No AI tools in intersection");
                p.cancel("No AI tools match. Run `baton ai-tools scan`.");
                process.exit(1);
            }

            const adapters = getAIToolAdaptersForKeys(syncedAiTools);
            const primaryAdapter = adapters.find((a) => a.key === args.tool);

            if (!primaryAdapter) {
                spinner.stop("Tool not found");
                p.cancel(
                    `Tool "${args.tool}" not found in synced tools: ${syncedAiTools.join(", ")}`,
                );
                process.exit(1);
            }

            // Validate diff target if provided
            let diffAdapter: AIToolAdapter | undefined;
            if (args.diff) {
                diffAdapter = adapters.find((a) => a.key === args.diff);
                if (!diffAdapter) {
                    spinner.stop("Diff tool not found");
                    p.cancel(
                        `Diff tool "${args.diff}" not found in synced tools: ${syncedAiTools.join(", ")}`,
                    );
                    process.exit(1);
                }
            }

            spinner.stop(
                diffAdapter
                    ? `Comparing: ${primaryAdapter.key} vs ${diffAdapter.key}`
                    : `Previewing for: ${primaryAdapter.key}`,
            );

            // Collect preview output for a given adapter
            async function collectPreview(adapter: AIToolAdapter): Promise<PreviewSection[]> {
                const sections: PreviewSection[] = [];

                function makeDirectiveContext(
                    scope: string,
                    contentType: string,
                ): DirectiveContext {
                    return {
                        projectRoot,
                        currentTool: adapter.key,
                        detectedTools: syncedAiTools,
                        detectedIdes: [],
                        scope,
                        contentType,
                    };
                }

                // --- Memory ---
                if (!typeFilter || typeFilter === "memory") {
                    for (const memoryEntry of mergedMemory) {
                        const contentParts: string[] = [];
                        for (const contribution of memoryEntry.contributions) {
                            const profileDir = profileLocalPaths.get(contribution.profileName);
                            if (!profileDir) continue;
                            const memoryFilePath = resolve(
                                profileDir,
                                "ai",
                                "memory",
                                memoryEntry.filename,
                            );
                            let rawContent: string;
                            try {
                                rawContent = await readFile(memoryFilePath, "utf-8");
                            } catch {
                                continue;
                            }

                            const processed = await processDirectives(rawContent, {
                                context: makeDirectiveContext(memoryEntry.scope, "memory"),
                            });
                            contentParts.push(processed);
                        }
                        if (contentParts.length === 0) continue;

                        const mergedContent = mergeContentParts(
                            contentParts,
                            memoryEntry.mergeStrategy,
                        );
                        const transformed = adapter.transformMemory({
                            filename: memoryEntry.filename,
                            content: mergedContent,
                        });
                        const targetPath = adapter.getPath(
                            "memory",
                            memoryEntry.scope,
                            transformed.filename,
                        );
                        sections.push({
                            filePath: targetPath,
                            content: normalizeMarkdown(transformed.content),
                        });
                    }
                }

                // --- Rules ---
                if (!typeFilter || typeFilter === "rules") {
                    const ruleAccumulator = new Map<string, string[]>();

                    for (const ruleEntry of mergedRules) {
                        const profileDir = profileLocalPaths.get(ruleEntry.profileName);
                        if (!profileDir) continue;

                        // Use sourceFilePaths from discovery to get the actual file location
                        const sourceFilePath = sourceFilePaths.get(`rules/${ruleEntry.name}`);
                        const ruleSourcePath =
                            sourceFilePath ??
                            resolve(profileDir, "ai", "rules", `${ruleEntry.name}.md`);

                        let rawContent: string;
                        try {
                            rawContent = await readFile(ruleSourcePath, "utf-8");
                        } catch {
                            continue;
                        }

                        const processed = await processDirectives(rawContent, {
                            context: makeDirectiveContext(ruleEntry.scope, "rules"),
                        });

                        const parsed = parseFrontmatter(processed);
                        const ruleFile: RuleFile = {
                            name: ruleEntry.name,
                            content: processed,
                            frontmatter:
                                Object.keys(parsed.data).length > 0
                                    ? (parsed.data as RuleFile["frontmatter"])
                                    : undefined,
                        };

                        const transformed = adapter.transformRule(ruleFile);
                        const targetPath = adapter.getPath(
                            "rules",
                            ruleEntry.scope,
                            ruleEntry.name,
                        );

                        const existing = ruleAccumulator.get(targetPath);
                        if (existing) {
                            existing.push(transformed.content);
                        } else {
                            ruleAccumulator.set(targetPath, [transformed.content]);
                        }
                    }

                    for (const [targetPath, parts] of ruleAccumulator) {
                        sections.push({
                            filePath: targetPath,
                            content: normalizeMarkdown(parts.join("\n\n")),
                        });
                    }
                }

                // --- Skills ---
                if (!typeFilter || typeFilter === "skills") {
                    for (const skillItem of mergedSkills) {
                        const profileDir = profileLocalPaths.get(skillItem.profileName);
                        if (!profileDir) continue;

                        const sourceSkillPath = sourceFilePaths.get(`skills/${skillItem.name}`);
                        const skillSourceDir =
                            sourceSkillPath ?? resolve(profileDir, "ai", "skills", skillItem.name);
                        const targetSkillPath = adapter.getPath(
                            "skills",
                            skillItem.scope,
                            skillItem.name,
                        );

                        const skillFilePath = resolve(skillSourceDir, "SKILL.md");
                        let rawContent: string;
                        try {
                            rawContent = await readFile(skillFilePath, "utf-8");
                        } catch {
                            continue;
                        }

                        const processed = await processDirectives(rawContent, {
                            context: makeDirectiveContext(skillItem.scope, "skills"),
                        });

                        sections.push({
                            filePath: `${targetSkillPath}/SKILL.md`,
                            content: processed,
                        });
                    }
                }

                // --- Commands ---
                if (!typeFilter || typeFilter === "commands") {
                    for (const cmdEntry of mergedCommands) {
                        const profileDir = profileLocalPaths.get(cmdEntry.profileName);
                        if (!profileDir) continue;

                        const sourceCommandPath = sourceFilePaths.get(`commands/${cmdEntry.name}`);
                        const commandSourcePath =
                            sourceCommandPath ??
                            resolve(profileDir, "ai", "commands", `${cmdEntry.name}.md`);

                        let rawContent: string;
                        try {
                            rawContent = await readFile(commandSourcePath, "utf-8");
                        } catch {
                            continue;
                        }

                        const processed = await processDirectives(rawContent, {
                            context: makeDirectiveContext(cmdEntry.scope, "commands"),
                        });

                        const targetPath = adapter.getPath(
                            "commands",
                            cmdEntry.scope,
                            cmdEntry.name,
                        );
                        sections.push({ filePath: targetPath, content: processed });
                    }
                }

                // --- Agents ---
                if (!typeFilter || typeFilter === "agents") {
                    for (const agentEntry of mergedAgents) {
                        const profileDir = profileLocalPaths.get(agentEntry.profileName);
                        if (!profileDir) continue;

                        const sourceAgentPath = sourceFilePaths.get(`agents/${agentEntry.name}`);
                        const agentSourcePath =
                            sourceAgentPath ??
                            resolve(profileDir, "ai", "agents", `${agentEntry.name}.md`);
                        let rawContent: string;
                        try {
                            rawContent = await readFile(agentSourcePath, "utf-8");
                        } catch {
                            continue;
                        }

                        const scope: Scope = resolveScope(agentEntry.scope, undefined);
                        const processed = await processDirectives(rawContent, {
                            context: makeDirectiveContext(scope, "agents"),
                        });

                        const targetPath = adapter.getPath("agents", scope, agentEntry.name);
                        sections.push({ filePath: targetPath, content: processed });
                    }
                }

                return sections;
            }

            // Collect primary tool output
            const primarySections = await collectPreview(primaryAdapter);

            if (diffAdapter) {
                // Diff mode: collect second tool output and compare
                const diffSections = await collectPreview(diffAdapter);

                const primaryMap = new Map(primarySections.map((s) => [s.filePath, s.content]));
                const diffMap = new Map(diffSections.map((s) => [s.filePath, s.content]));
                const allPaths = new Set([...primaryMap.keys(), ...diffMap.keys()]);

                let hasDifferences = false;

                for (const filePath of [...allPaths].sort()) {
                    const primaryContent = primaryMap.get(filePath);
                    const diffContent = diffMap.get(filePath);

                    if (primaryContent === diffContent) continue;

                    hasDifferences = true;

                    // Show a simple side-by-side label for files that differ
                    const onlyInPrimary = primaryContent !== undefined && diffContent === undefined;
                    const onlyInDiff = primaryContent === undefined && diffContent !== undefined;

                    if (onlyInPrimary) {
                        p.log.info(pc.yellow(`--- only in ${primaryAdapter.key}: ${filePath} ---`));
                        p.log.message(primaryContent ?? "");
                    } else if (onlyInDiff) {
                        p.log.info(pc.yellow(`--- only in ${diffAdapter.key}: ${filePath} ---`));
                        p.log.message(diffContent ?? "");
                    } else {
                        p.log.info(
                            pc.yellow(
                                `--- ${primaryAdapter.key} vs ${diffAdapter.key}: ${filePath} ---`,
                            ),
                        );
                        p.log.message(`[${primaryAdapter.key}]`);
                        p.log.message(primaryContent ?? "");
                        p.log.message(`[${diffAdapter.key}]`);
                        p.log.message(diffContent ?? "");
                    }
                }

                if (!hasDifferences) {
                    p.log.info(
                        `No differences between ${primaryAdapter.key} and ${diffAdapter.key}`,
                    );
                }
            } else {
                // Standard mode: print sections
                for (const section of primarySections) {
                    p.log.info(pc.dim(`--- ${section.filePath} ---`));
                    p.log.message(section.content);
                }
            }

            p.outro("Preview complete");
        } catch (error) {
            p.log.error(
                `Failed to run preview: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
            process.exit(1);
        }
    },
});
