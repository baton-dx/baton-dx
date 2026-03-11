import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
    type ClonedSource,
    type DirectiveContext,
    type MemoryEntry,
    type MergedSkillItem,
    type RuleEntry,
    type RuleFile,
    type Scope,
    cloneGitSource,
    detectInstalledAITools,
    getAIToolAdaptersForKeys,
    getAuthenticatedUrl,
    getAuthSetupInstructions,
    getGlobalAiTools,
    getGlobalIdePlatforms,
    loadProfileManifest,
    loadProjectManifest,
    mergeContentParts,
    mergeMemory,
    mergeRules,
    mergeSkills,
    normalizeMarkdown,
    parseFrontmatter,
    parseSource,
    processDirectives,
    resolveAuth,
    resolveNpmSource,
    resolveProfileChain,
    resolveScope,
} from "@baton-dx/core";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { buildIntersection } from "../utils/build-intersection.js";

const VALID_TYPES = ["memory", "rules", "agents", "skills", "commands"] as const;
type ContentType = (typeof VALID_TYPES)[number];

export const previewCommand = defineCommand({
    meta: {
        name: "preview",
        description:
            "Preview processed output for a specific AI tool, with directive processing",
    },
    args: {
        tool: {
            type: "string",
            description: 'AI tool key (e.g. "claude-code", "cursor")',
            required: true,
        },
        type: {
            type: "string",
            description:
                "Filter to a content type: memory, rules, agents, skills, commands",
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

            // Step 1: Resolve profile chains (identical to diff.ts)
            const spinner = p.spinner();
            spinner.start("Resolving profile chain...");

            const allProfiles = [];
            const profileLocalPaths = new Map<string, string>();

            for (const profileSource of manifest.profiles) {
                try {
                    const parsed = parseSource(profileSource.source);

                    let profileManifestPath: string;
                    let localPath: string;

                    if (parsed.provider === "local" || parsed.provider === "file") {
                        localPath = parsed.path.startsWith("/")
                            ? parsed.path
                            : resolve(projectRoot, parsed.path);
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
                        profileLocalPaths.set(prof.name, localPath);
                    }
                    allProfiles.push(...chain);
                } catch (error) {
                    spinner.message(
                        `Failed to resolve profile ${profileSource.source}: ${error instanceof Error ? error.message : error}`,
                    );
                }
            }

            if (allProfiles.length === 0) {
                spinner.stop("No profiles resolved");
                p.outro("Nothing to preview. Run `baton manage` to add a profile.");
                process.exit(0);
            }

            spinner.stop(`Resolved ${allProfiles.length} profile(s)`);

            // Step 2: Merge configurations
            spinner.start("Merging configurations...");

            const mergedSkills: MergedSkillItem[] = mergeSkills(allProfiles);
            const mergedRules: RuleEntry[] = mergeRules(allProfiles);
            const mergedMemory: MemoryEntry[] = mergeMemory(allProfiles);

            const commandMap = new Map<string, { profileName: string; scope: Scope }>();
            for (const profile of allProfiles) {
                for (const cmd of profile.manifest.ai?.commands || []) {
                    commandMap.set(cmd, {
                        profileName: profile.name,
                        scope: resolveScope(undefined, profile.manifest.scope),
                    });
                }
            }

            spinner.stop("Configurations merged");

            // Step 3: Compute tool intersection, find matching adapter
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
            const adapter = adapters.find((a) => a.key === args.tool);

            if (!adapter) {
                spinner.stop("Tool not found");
                p.cancel(
                    `Tool "${args.tool}" not found in synced tools: ${syncedAiTools.join(", ")}`,
                );
                process.exit(1);
            }

            spinner.stop(`Previewing for: ${adapter.key}`);

            // Helper to build directive context
            function makeDirectiveContext(
                profileDir: string,
                profileName: string,
                scope: string,
                contentType: string,
            ): DirectiveContext {
                return {
                    projectRoot,
                    profileRoot: profileDir,
                    profileName,
                    currentTool: adapter!.key,
                    detectedTools: syncedAiTools,
                    detectedIdes: [],
                    scope,
                    contentType,
                };
            }

            // Helper to output a file section
            function outputSection(filePath: string, content: string): void {
                console.log(`\x1b[2m--- ${filePath} ---\x1b[0m`);
                console.log(content);
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
                            context: makeDirectiveContext(
                                profileDir,
                                contribution.profileName,
                                memoryEntry.scope,
                                "memory",
                            ),
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
                    outputSection(targetPath, normalizeMarkdown(transformed.content));
                }
            }

            // --- Rules ---
            if (!typeFilter || typeFilter === "rules") {
                const ruleAccumulator = new Map<string, string[]>();

                for (const ruleEntry of mergedRules) {
                    const isUniversal = ruleEntry.agents.length === 0;
                    const isForThisAdapter = ruleEntry.agents.includes(adapter.key);
                    if (!isUniversal && !isForThisAdapter) continue;

                    const profileDir = profileLocalPaths.get(ruleEntry.profileName);
                    if (!profileDir) continue;

                    const ruleSubdir = isUniversal ? "universal" : ruleEntry.agents[0];
                    const ruleSourcePath = resolve(
                        profileDir,
                        "ai",
                        "rules",
                        ruleSubdir,
                        `${ruleEntry.name}.md`,
                    );

                    let rawContent: string;
                    try {
                        rawContent = await readFile(ruleSourcePath, "utf-8");
                    } catch {
                        continue;
                    }

                    const processed = await processDirectives(rawContent, {
                        context: makeDirectiveContext(
                            profileDir,
                            ruleEntry.profileName,
                            ruleEntry.scope,
                            "rules",
                        ),
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
                    const targetPath = adapter.getPath("rules", ruleEntry.scope, ruleEntry.name);

                    const existing = ruleAccumulator.get(targetPath);
                    if (existing) {
                        existing.push(transformed.content);
                    } else {
                        ruleAccumulator.set(targetPath, [transformed.content]);
                    }
                }

                for (const [targetPath, parts] of ruleAccumulator) {
                    outputSection(targetPath, normalizeMarkdown(parts.join("\n\n")));
                }
            }

            // --- Skills ---
            if (!typeFilter || typeFilter === "skills") {
                for (const skillItem of mergedSkills) {
                    const profileDir = profileLocalPaths.get(skillItem.profileName);
                    if (!profileDir) continue;
                    const skillSourceDir = resolve(profileDir, "ai", "skills", skillItem.name);
                    const targetSkillPath = adapter.getPath(
                        "skills",
                        skillItem.scope,
                        skillItem.name,
                    );

                    // Read SKILL.md from skill directory
                    const skillFilePath = resolve(skillSourceDir, "SKILL.md");
                    let rawContent: string;
                    try {
                        rawContent = await readFile(skillFilePath, "utf-8");
                    } catch {
                        continue;
                    }

                    const processed = await processDirectives(rawContent, {
                        context: makeDirectiveContext(
                            profileDir,
                            skillItem.profileName,
                            skillItem.scope,
                            "skills",
                        ),
                    });

                    outputSection(`${targetSkillPath}/SKILL.md`, processed);
                }
            }

            // --- Commands ---
            if (!typeFilter || typeFilter === "commands") {
                for (const [commandName, { profileName, scope }] of commandMap) {
                    const profileDir = profileLocalPaths.get(profileName);
                    if (!profileDir) continue;

                    const commandSourcePath = resolve(
                        profileDir,
                        "ai",
                        "commands",
                        `${commandName}.md`,
                    );
                    let rawContent: string;
                    try {
                        rawContent = await readFile(commandSourcePath, "utf-8");
                    } catch {
                        continue;
                    }

                    const processed = await processDirectives(rawContent, {
                        context: makeDirectiveContext(
                            profileDir,
                            profileName,
                            scope,
                            "commands",
                        ),
                    });

                    const targetPath = adapter.getPath("commands", scope, commandName);
                    outputSection(targetPath, processed);
                }
            }

            // --- Agents ---
            if (!typeFilter || typeFilter === "agents") {
                for (const profile of allProfiles) {
                    const profileDir = profileLocalPaths.get(profile.name);
                    if (!profileDir) continue;

                    const agentsRaw = profile.manifest.ai?.agents;
                    const agentNames: string[] = Array.isArray(agentsRaw)
                        ? agentsRaw
                        : agentsRaw
                          ? Object.values(agentsRaw).flat().filter((n): n is string => typeof n === "string")
                          : [];
                    for (const agentName of agentNames) {
                        const agentSourcePath = resolve(
                            profileDir,
                            "ai",
                            "agents",
                            `${agentName}.md`,
                        );
                        let rawContent: string;
                        try {
                            rawContent = await readFile(agentSourcePath, "utf-8");
                        } catch {
                            continue;
                        }

                        const scope = resolveScope(undefined, profile.manifest.scope);
                        const processed = await processDirectives(rawContent, {
                            context: makeDirectiveContext(
                                profileDir,
                                profile.name,
                                scope,
                                "agents",
                            ),
                        });

                        const targetPath = adapter.getPath("agents", scope, agentName);
                        outputSection(targetPath, processed);
                    }
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
