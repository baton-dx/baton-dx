import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
    type ClonedSource,
    cloneGitSource,
    detectInstalledAITools,
    getAIToolAdaptersForKeys,
    getAuthenticatedUrl,
    getAuthSetupInstructions,
    getGlobalAiTools,
    getGlobalIdePlatforms,
    getIdePlatformTargetDir,
    loadProfileManifest,
    loadProjectManifest,
    type MemoryEntry,
    type MergedSkillItem,
    mergeContentParts,
    mergeMemory,
    mergeRules,
    mergeSkills,
    normalizeMarkdown,
    parseFrontmatter,
    parseSource,
    type RuleEntry,
    type RuleFile,
    resolveAuth,
    resolveNpmSource,
    resolveProfileChain,
    resolveScope,
    type Scope,
} from "@baton-dx/core";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { buildIntersection } from "../utils/build-intersection.js";

interface DiffEntry {
    /** Relative display path (e.g. ".claude/rules/coding-standards.md") */
    file: string;
    status: "added" | "modified" | "removed";
    remoteContent?: string;
    localContent?: string;
}

export const diffCommand = defineCommand({
    meta: {
        name: "diff",
        description:
            "Compare local installed files with remote source versions to see what changed",
    },
    args: {
        nameOnly: {
            type: "boolean",
            description: "Show only changed filenames without content diff",
            alias: "n",
        },
    },
    async run({ args }) {
        p.intro("🔍 Baton Diff");

        try {
            const projectRoot = process.cwd();
            const manifestPath = resolve(projectRoot, "baton.yaml");
            const manifest = await loadProjectManifest(manifestPath);

            if (!manifest.profiles || manifest.profiles.length === 0) {
                p.outro("⚠️  No profiles configured in baton.yaml");
                process.exit(0);
            }

            // Step 1: Resolve profile chains (same as sync.ts)
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
                            useCache: false, // Always fetch fresh for diff comparison
                        });
                        localPath = resolved.localPath;
                        profileManifestPath = resolve(resolved.localPath, "baton.profile.yaml");
                    } else {
                        const url = parsed.url;
                        const subpath =
                            parsed.provider === "github" || parsed.provider === "gitlab"
                                ? parsed.subpath
                                : undefined;

                        // Pre-resolve auth via cascade
                        const hostname = new URL(url).hostname;
                        const auth = await resolveAuth(hostname);
                        if (auth.method === "none") {
                            spinner.message(
                                `Skipping ${profileSource.source}: ${getAuthSetupInstructions(hostname)}`,
                            );
                            continue;
                        }
                        const cloneUrl = await getAuthenticatedUrl(url, auth);

                        const cloned: ClonedSource = await cloneGitSource({
                            url: cloneUrl,
                            ref: profileSource.version || undefined,
                            subpath,
                            useCache: false, // Always fetch fresh for diff
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
                p.outro("Nothing to diff. Run `baton manage` to add a profile.");
                process.exit(0);
            }

            spinner.stop(`Resolved ${allProfiles.length} profile(s)`);

            // Step 2: Merge configurations (same as sync.ts)
            spinner.start("Merging configurations...");

            const mergedSkills: MergedSkillItem[] = mergeSkills(allProfiles);
            const mergedRules: RuleEntry[] = mergeRules(allProfiles);
            const mergedMemory: MemoryEntry[] = mergeMemory(allProfiles);

            // Collect commands
            const commandMap = new Map<string, { profileName: string; scope: Scope }>();
            for (const profile of allProfiles) {
                for (const cmd of profile.manifest.ai?.commands || []) {
                    commandMap.set(cmd, {
                        profileName: profile.name,
                        scope: resolveScope(undefined, profile.manifest.scope),
                    });
                }
            }

            // Collect files
            const fileMap = new Map<
                string,
                { source: string; target: string; profileName: string }
            >();
            for (const profile of allProfiles) {
                for (const fileConfig of profile.manifest.files || []) {
                    const target = fileConfig.target || fileConfig.source;
                    fileMap.set(target, {
                        source: fileConfig.source,
                        target,
                        profileName: profile.name,
                    });
                }
            }

            // Collect IDE configs (uses central IDE platform registry)
            const ideMap = new Map<
                string,
                {
                    ideKey: string;
                    fileName: string;
                    targetDir: string;
                    profileName: string;
                }
            >();
            for (const profile of allProfiles) {
                if (!profile.manifest.ide) continue;
                for (const [ideKey, files] of Object.entries(profile.manifest.ide)) {
                    if (!files) continue;
                    const targetDir = getIdePlatformTargetDir(ideKey);
                    if (!targetDir) continue;
                    for (const fileName of files) {
                        const targetPath = `${targetDir}/${fileName}`;
                        ideMap.set(targetPath, {
                            ideKey,
                            fileName,
                            targetDir,
                            profileName: profile.name,
                        });
                    }
                }
            }

            spinner.stop("Configurations merged");

            // Step 3: Determine which AI tools to diff (intersection-based, like sync.ts)
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
            spinner.stop(`Comparing for: ${syncedAiTools.join(", ")}`);

            // Step 4: Build expected file map (remote content → placed path)
            spinner.start("Comparing remote sources with placed files...");

            const diffs: DiffEntry[] = [];
            // Track all expected placed paths to detect "removed" files
            const expectedPaths = new Set<string>();

            // Content accumulator for files that may receive content from multiple categories
            // (e.g., GitHub Copilot uses .github/copilot-instructions.md for both memory AND rules)
            // Key: relativePath, Value: { parts }
            const contentAccumulator = new Map<string, { parts: string[]; absolutePath: string }>();

            // --- Memory files (accumulate) ---
            for (const adapter of adapters) {
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
                        try {
                            contentParts.push(await readFile(memoryFilePath, "utf-8"));
                        } catch {
                            // skip missing
                        }
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
                    const absolutePath = resolveAbsolutePath(targetPath, projectRoot);
                    const relativePath = toRelativePath(absolutePath, projectRoot);
                    expectedPaths.add(relativePath);

                    // Accumulate instead of directly adding diff entry
                    const existing = contentAccumulator.get(relativePath);
                    if (existing) {
                        existing.parts.push(transformed.content);
                    } else {
                        contentAccumulator.set(relativePath, {
                            parts: [transformed.content],
                            absolutePath,
                        });
                    }
                }
            }

            // --- Skills ---
            for (const adapter of adapters) {
                for (const skillItem of mergedSkills) {
                    const profileDir = profileLocalPaths.get(skillItem.profileName);
                    if (!profileDir) continue;
                    const skillSourceDir = resolve(profileDir, "ai", "skills", skillItem.name);
                    try {
                        await stat(skillSourceDir);
                    } catch {
                        continue;
                    }
                    const targetSkillPath = adapter.getPath(
                        "skills",
                        skillItem.scope,
                        skillItem.name,
                    );
                    const absoluteTargetDir = resolveAbsolutePath(targetSkillPath, projectRoot);

                    // Compare all files in skill directory
                    const remoteSkillFiles = await loadFilesFromDirectory(skillSourceDir);
                    const localSkillFiles = await loadFilesFromDirectory(absoluteTargetDir);

                    for (const [file, remoteContent] of Object.entries(remoteSkillFiles)) {
                        const relPath = toRelativePath(
                            resolve(absoluteTargetDir, file),
                            projectRoot,
                        );
                        expectedPaths.add(relPath);
                        addDiffEntry(
                            diffs,
                            relPath,
                            remoteContent,
                            localSkillFiles[file] ?? undefined,
                        );
                    }
                    // Check for local-only files (removed in remote)
                    for (const file of Object.keys(localSkillFiles)) {
                        const relPath = toRelativePath(
                            resolve(absoluteTargetDir, file),
                            projectRoot,
                        );
                        if (!expectedPaths.has(relPath)) {
                            addDiffEntry(diffs, relPath, undefined, localSkillFiles[file]);
                        }
                    }
                }
            }

            // --- Rules (accumulate) ---
            for (const adapter of adapters) {
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

                    const parsed = parseFrontmatter(rawContent);
                    const ruleFile: RuleFile = {
                        name: ruleEntry.name,
                        content: rawContent,
                        frontmatter:
                            Object.keys(parsed.data).length > 0
                                ? (parsed.data as RuleFile["frontmatter"])
                                : undefined,
                    };

                    const transformed = adapter.transformRule(ruleFile);
                    const targetPath = adapter.getPath("rules", ruleEntry.scope, ruleEntry.name);
                    const absolutePath = resolveAbsolutePath(targetPath, projectRoot);
                    const relativePath = toRelativePath(absolutePath, projectRoot);
                    expectedPaths.add(relativePath);

                    // Accumulate instead of directly adding diff entry
                    const existing = contentAccumulator.get(relativePath);
                    if (existing) {
                        existing.parts.push(transformed.content);
                    } else {
                        contentAccumulator.set(relativePath, {
                            parts: [transformed.content],
                            absolutePath,
                        });
                    }
                }
            }

            // --- Flush accumulated content (memory + rules combined per target path) ---
            for (const [relativePath, entry] of contentAccumulator) {
                const combinedContent = normalizeMarkdown(entry.parts.join("\n\n"));
                addDiffEntry(
                    diffs,
                    relativePath,
                    combinedContent,
                    await readSafe(entry.absolutePath),
                );
            }

            // --- Commands ---
            for (const adapter of adapters) {
                for (const [commandName, { profileName, scope }] of commandMap) {
                    const profileDir = profileLocalPaths.get(profileName);
                    if (!profileDir) continue;

                    const commandSourcePath = resolve(
                        profileDir,
                        "ai",
                        "commands",
                        `${commandName}.md`,
                    );
                    let content: string;
                    try {
                        content = await readFile(commandSourcePath, "utf-8");
                    } catch {
                        continue;
                    }

                    const targetPath = adapter.getPath("commands", scope, commandName);
                    const absolutePath = resolveAbsolutePath(targetPath, projectRoot);
                    const relativePath = toRelativePath(absolutePath, projectRoot);
                    expectedPaths.add(relativePath);

                    addDiffEntry(diffs, relativePath, content, await readSafe(absolutePath));
                }
            }

            // --- Files (project root, no adapter) ---
            for (const fileEntry of fileMap.values()) {
                const profileDir = profileLocalPaths.get(fileEntry.profileName);
                if (!profileDir) continue;

                const fileSourcePath = resolve(profileDir, "files", fileEntry.source);
                let content: string;
                try {
                    content = await readFile(fileSourcePath, "utf-8");
                } catch {
                    continue;
                }

                const absolutePath = resolve(projectRoot, fileEntry.target);
                const relativePath = fileEntry.target;
                expectedPaths.add(relativePath);

                addDiffEntry(diffs, relativePath, content, await readSafe(absolutePath));
            }

            // --- IDE configs (project root, no adapter) ---
            for (const ideEntry of ideMap.values()) {
                const profileDir = profileLocalPaths.get(ideEntry.profileName);
                if (!profileDir) continue;

                const ideSourcePath = resolve(
                    profileDir,
                    "ide",
                    ideEntry.ideKey,
                    ideEntry.fileName,
                );
                let content: string;
                try {
                    content = await readFile(ideSourcePath, "utf-8");
                } catch {
                    continue;
                }

                const absolutePath = resolve(projectRoot, ideEntry.targetDir, ideEntry.fileName);
                const relativePath = `${ideEntry.targetDir}/${ideEntry.fileName}`;
                expectedPaths.add(relativePath);

                addDiffEntry(diffs, relativePath, content, await readSafe(absolutePath));
            }

            spinner.stop();

            // Step 5: Display results
            if (diffs.length === 0) {
                p.log.success("No differences found");
                p.outro("✅ Diff complete - all placed files match remote sources");
                process.exit(0);
            }

            p.log.warning(`${diffs.length} file(s) with differences`);

            for (const diff of diffs) {
                if (args.nameOnly) {
                    const statusSymbol =
                        diff.status === "added" ? "+" : diff.status === "removed" ? "-" : "~";
                    console.log(`  ${statusSymbol} ${diff.file}`);
                } else {
                    console.log(`\n  📄 ${diff.file} (${diff.status})`);

                    if (diff.status === "modified") {
                        const localLines = (diff.localContent || "").split("\n");
                        const remoteLines = (diff.remoteContent || "").split("\n");

                        const maxLines = Math.max(localLines.length, remoteLines.length);
                        let diffLines = 0;
                        for (let i = 0; i < maxLines && diffLines < 10; i++) {
                            const localLine = localLines[i] || "";
                            const remoteLine = remoteLines[i] || "";

                            if (localLine !== remoteLine) {
                                diffLines++;
                                if (localLine) {
                                    console.log(`  \x1b[31m- ${localLine}\x1b[0m`);
                                }
                                if (remoteLine) {
                                    console.log(`  \x1b[32m+ ${remoteLine}\x1b[0m`);
                                }
                            }
                        }

                        if (diffLines >= 10) {
                            console.log("  ... (more differences)");
                        }
                    } else if (diff.status === "added") {
                        console.log(
                            "  \x1b[32m+ New file in remote (not yet placed locally)\x1b[0m",
                        );
                    } else {
                        console.log("  \x1b[31m- File exists locally but not in remote\x1b[0m");
                    }
                }
            }

            p.outro("✅ Diff complete - differences found. Run `baton sync` to update.");
            process.exit(1);
        } catch (error) {
            p.log.error(
                `Failed to run diff: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
            process.exit(1);
        }
    },
});

/**
 * Add a diff entry if remote and local content differ.
 */
function addDiffEntry(
    diffs: DiffEntry[],
    file: string,
    remoteContent: string | undefined,
    localContent: string | undefined,
): void {
    // Deduplicate: skip if this file already has a diff entry
    if (diffs.some((d) => d.file === file)) return;

    if (remoteContent !== undefined && localContent === undefined) {
        diffs.push({ file, status: "added", remoteContent });
    } else if (remoteContent === undefined && localContent !== undefined) {
        diffs.push({ file, status: "removed", localContent });
    } else if (
        remoteContent !== undefined &&
        localContent !== undefined &&
        remoteContent !== localContent
    ) {
        diffs.push({ file, status: "modified", remoteContent, localContent });
    }
}

/**
 * Read a file safely, returning undefined if it doesn't exist.
 */
async function readSafe(path: string): Promise<string | undefined> {
    try {
        return await readFile(path, "utf-8");
    } catch {
        return undefined;
    }
}

/**
 * Resolve a path to absolute, handling both absolute and relative paths.
 */
function resolveAbsolutePath(path: string, projectRoot: string): string {
    if (path.startsWith("/")) return path;
    return resolve(projectRoot, path);
}

/**
 * Convert an absolute path to a relative path from project root.
 */
function toRelativePath(absolutePath: string, projectRoot: string): string {
    if (absolutePath.startsWith(projectRoot)) {
        const rel = absolutePath.slice(projectRoot.length);
        return rel.startsWith("/") ? rel.slice(1) : rel;
    }
    return absolutePath;
}

/**
 * Load all files from a directory recursively
 */
async function loadFilesFromDirectory(dirPath: string): Promise<Record<string, string>> {
    const files: Record<string, string> = {};

    try {
        const entries = await readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = resolve(dirPath, entry.name);

            if (entry.isDirectory()) {
                const subFiles = await loadFilesFromDirectory(fullPath);
                for (const [subPath, content] of Object.entries(subFiles)) {
                    files[`${entry.name}/${subPath}`] = content;
                }
            } else if (entry.isFile()) {
                const content = await readFile(fullPath, "utf-8");
                files[entry.name] = content;
            }
        }
    } catch {
        return {};
    }

    return files;
}
