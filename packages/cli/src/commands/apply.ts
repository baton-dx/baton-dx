import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import {
    type AgentEntry,
    type AgentFile,
    type AIToolAdapter,
    assembleContentFromDiscovery,
    atomicWriteFile,
    type CloneContext,
    type CommandEntry,
    checkLockfileVersion,
    checkSourceBatonRequires,
    cloneGitSource,
    createGit,
    detectInstalledAITools,
    detectInstalledIdes,
    detectLegacyPaths,
    discoverProfile,
    expandLocalPath,
    FileNotFoundError,
    type FilePlacement,
    findSourceManifest,
    getAIToolAdaptersForKeys,
    getAuthenticatedUrl,
    getAuthSetupInstructions,
    type LockFile,
    type LockFileEntry,
    loadProfileManifest,
    loadProjectManifest,
    type MemoryEntry,
    type MergedSkillItem,
    mergeContentParts,
    normalizeMarkdown,
    type ParsedSource,
    type ProjectManifest,
    parseFrontmatter,
    parseSource,
    placeFile,
    processDirectives,
    type RuleEntry,
    type RuleFile,
    readLock,
    resolveAuth,
    resolvePreferences,
    resolveProfileChain,
    type Scope,
    sortProfilesByWeight,
} from "@baton-dx/core";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { buildIntersection } from "../utils/build-intersection.js";
import { promptFirstRunPreferences } from "../utils/first-run-preferences.js";
import { displayIntersection, formatIntersectionSummary } from "../utils/intersection-display.js";
import { readCurrentVersion } from "../utils/read-current-version.js";
import { runProfileHook } from "../utils/run-hook.js";
import {
    cleanupOrphanedFiles,
    copyDirectoryRecursive,
    createSyncStats,
    formatSyncReport,
    getOrCreatePlacedFiles,
    handleGitignoreUpdate,
    loadPreviousPlacedPaths,
    type SyncCategory,
    validCategories,
    writeLockData,
    writeStateData,
} from "./sync-pipeline.js";

/** Extract the package name from a source string for lockfile lookup. */
function getPackageNameFromSource(source: string, parsed: ParsedSource): string {
    if (parsed.provider === "github" || parsed.provider === "gitlab") {
        return `${parsed.org}/${parsed.repo}`;
    }
    if (parsed.provider === "npm") {
        return parsed.scope ? `${parsed.scope}/${parsed.package}` : parsed.package;
    }
    if (parsed.provider === "git") {
        return parsed.url;
    }
    return source;
}

export const applyCommand = defineCommand({
    meta: {
        name: "apply",
        description: "Apply locked configurations to the project (deterministic, reproducible)",
    },
    args: {
        "dry-run": {
            type: "boolean",
            description: "Show what would be done without writing files",
            default: false,
        },
        category: {
            type: "string",
            description: "Apply only a specific category: ai, files, or ide",
            required: false,
        },
        yes: {
            type: "boolean",
            description: "Run non-interactively (no prompts)",
            default: false,
        },
        verbose: {
            type: "boolean",
            alias: "v",
            description: "Show detailed output for each placed file",
            default: false,
        },
        fresh: {
            type: "boolean",
            description: "Force cache bypass (re-clone even if cached)",
            default: false,
        },
    },
    async run({ args }) {
        const dryRun = args["dry-run"];
        const categoryArg = args.category as string | undefined;
        const autoYes = args.yes;
        const verbose = args.verbose;
        const fresh = args.fresh;

        // Validate --category flag
        let category: SyncCategory | undefined;
        if (categoryArg) {
            if (!validCategories.includes(categoryArg as SyncCategory)) {
                p.cancel(
                    `Invalid category "${categoryArg}". Valid categories: ${validCategories.join(", ")}`,
                );
                process.exit(1);
            }
            category = categoryArg as SyncCategory;
        }

        const syncAi = !category || category === "ai";
        const syncFiles = !category || category === "files";
        const syncIde = !category || category === "ide";

        p.intro(category ? `📦 Baton Apply (category: ${category})` : "📦 Baton Apply");

        // Statistics tracking
        const stats = createSyncStats();

        try {
            // Step 0: Load project manifest
            const projectRoot = process.cwd();
            const manifestPath = resolve(projectRoot, "baton.yaml");

            let projectManifest: ProjectManifest;
            try {
                projectManifest = await loadProjectManifest(manifestPath);
            } catch (error) {
                if (error instanceof FileNotFoundError) {
                    p.cancel("baton.yaml not found. Run `baton init` first.");
                } else {
                    p.cancel(
                        `Failed to load baton.yaml: ${error instanceof Error ? error.message : String(error)}`,
                    );
                }
                process.exit(1);
            }

            // Step 0a: First-run preferences check
            await promptFirstRunPreferences(projectRoot, !!args.yes);

            // Step 0b: Read lockfile for locked SHAs
            const currentVersion = await readCurrentVersion();
            const lockfilePath = resolve(projectRoot, "baton.lock");
            let lockfile: LockFile | null = null;
            try {
                lockfile = await readLock(lockfilePath);
            } catch {
                // No lockfile — fall back to manifest versions
                if (verbose) {
                    p.log.warn("No lockfile found. Falling back to manifest versions.");
                }
            }

            // Step 0b+: Check if installed Baton is older than the lockfile version
            if (lockfile) {
                const versionWarning = checkLockfileVersion(lockfile, currentVersion);
                if (versionWarning) {
                    p.log.warn(versionWarning);
                    if (!autoYes) {
                        const { detectInstallMethod, formatInstallCommand } = await import(
                            "@baton-dx/core"
                        );
                        const installMethod = await detectInstallMethod();
                        if (installMethod.type !== "unknown") {
                            const confirmed = await p.confirm({
                                message: `Run \`${formatInstallCommand(installMethod)}\` now to update?`,
                                initialValue: false,
                            });
                            if (!p.isCancel(confirmed) && confirmed) {
                                const { execFile } = await import("node:child_process");
                                await new Promise<void>((resolve, reject) => {
                                    execFile(installMethod.bin, installMethod.args, (error) => {
                                        if (error) reject(error);
                                        else resolve();
                                    });
                                });
                                p.log.success(
                                    "Baton updated — continuing apply with new version...",
                                );
                            }
                        }
                    }
                }
            }

            // Step 0c: Compute cache TTL (apply uses cache by default, --fresh bypasses)
            const maxCacheAgeMs = fresh ? 0 : undefined;

            // Step 0d: Read previous placement state to detect orphaned files later
            // Uses .baton/state.yaml (preferred) or falls back to old lockfile keys (legacy migration)
            const previousPaths = await loadPreviousPlacedPaths(projectRoot);

            // Step 1: Resolve profile chain
            const spinner = p.spinner();
            spinner.start("Resolving profile chain...");

            const allProfiles = [];
            // Track SHA per source for lockfile
            const sourceShas = new Map<string, string>();
            // Track authenticated URL + token per source for reuse in Step 5
            const sourceAuth = new Map<string, { cloneUrl: string; authToken?: string }>();
            // Track source roots already checked for baton-cli version requirement
            const checkedSourceRoots = new Set<string>();
            for (const profileSource of projectManifest.profiles || []) {
                try {
                    if (verbose) {
                        p.log.info(`Resolving source: ${profileSource.source}`);
                    }
                    // Load the profile manifest first
                    const parsed = parseSource(profileSource.source);

                    let manifestPath: string;
                    let cloneContext: CloneContext | undefined;
                    if (parsed.provider === "local" || parsed.provider === "file") {
                        const absolutePath = expandLocalPath(parsed.path, projectRoot);
                        manifestPath = resolve(absolutePath, "baton.profile.yaml");
                        // Try to get SHA from local git repo, fallback to "local"
                        try {
                            const git = createGit(absolutePath);
                            await git.checkIsRepo();
                            const sha = await git.revparse(["HEAD"]);
                            sourceShas.set(profileSource.source, sha.trim());
                        } catch {
                            sourceShas.set(profileSource.source, "local");
                        }
                    } else {
                        // For remote sources, clone first
                        const url =
                            parsed.provider === "github" || parsed.provider === "gitlab"
                                ? parsed.url
                                : parsed.provider === "git"
                                  ? parsed.url
                                  : "";

                        if (!url) {
                            throw new Error(`Invalid source: ${profileSource.source}`);
                        }

                        // Pre-resolve auth via cascade
                        const hostname = new URL(url).hostname;
                        const auth = await resolveAuth(hostname);
                        if (auth.method === "none") {
                            p.log.warn(
                                `Skipping ${profileSource.source}: ${getAuthSetupInstructions(hostname, auth.triedMethods)}`,
                            );
                            continue;
                        }
                        const cloneUrl = await getAuthenticatedUrl(url, auth);
                        sourceAuth.set(profileSource.source, { cloneUrl, authToken: auth.token });

                        // Determine ref: use locked SHA if available, otherwise profileSource.version
                        let ref = profileSource.version;
                        if (lockfile) {
                            const packageName = getPackageNameFromSource(
                                profileSource.source,
                                parsed,
                            );
                            const lockedPkg = lockfile.packages[packageName];
                            if (lockedPkg?.sha && lockedPkg.sha !== "unknown") {
                                ref = lockedPkg.sha;
                                if (verbose) {
                                    p.log.info(
                                        `Using locked SHA for ${profileSource.source}: ${ref.slice(0, 12)}`,
                                    );
                                }
                            }
                        }

                        const cloned = await cloneGitSource({
                            url: cloneUrl,
                            ref,
                            subpath: "subpath" in parsed ? parsed.subpath : undefined,
                            useCache: true,
                            maxCacheAgeMs,
                            authToken: auth.token,
                        });
                        manifestPath = resolve(cloned.localPath, "baton.profile.yaml");
                        sourceShas.set(profileSource.source, cloned.sha);
                        cloneContext = {
                            cachePath: cloned.cachePath,
                            sparseCheckout: cloned.sparseCheckout,
                            authToken: auth.token,
                            cloneUrl,
                        };
                    }

                    const manifest = await loadProfileManifest(manifestPath);
                    const profileDir = dirname(manifestPath);

                    // Check requires["baton-cli"] once per source root
                    const sourceRoot = resolve(profileDir, "../..");
                    if (!checkedSourceRoots.has(sourceRoot)) {
                        checkedSourceRoots.add(sourceRoot);
                        const sourceMeta = await findSourceManifest(sourceRoot).catch(() => null);
                        const requiresBatonCli = sourceMeta?.requires?.["baton-cli"];
                        if (requiresBatonCli) {
                            const err = checkSourceBatonRequires(requiresBatonCli, currentVersion);
                            if (err) {
                                spinner.stop("Version requirement not met");
                                p.cancel(err);
                                process.exit(1);
                            }
                        }
                    }

                    const chain = await resolveProfileChain(
                        manifest,
                        profileSource.source,
                        profileDir,
                        cloneContext,
                    );
                    allProfiles.push(...chain);
                } catch (error) {
                    spinner.stop(`Failed to resolve profile ${profileSource.source}: ${error}`);
                    stats.errors++;
                }
            }

            if (allProfiles.length === 0) {
                spinner.stop("No profiles configured");
                p.outro("Nothing to apply. Run `baton manage` to add a profile.");
                process.exit(2);
            }

            spinner.stop(`Resolved ${allProfiles.length} profile(s)`);

            // Step 1b: Sort profiles by weight for merge ordering
            const weightSortedProfiles = sortProfilesByWeight(allProfiles);

            // Step 2: Merge configurations via filesystem discovery
            spinner.start("Merging configurations...");

            // Build a map from profile name to local directory path (needed for discovery)
            const earlyLocalPaths = new Map<string, string>();
            for (const prof of weightSortedProfiles) {
                if (prof.localPath) {
                    earlyLocalPaths.set(prof.name, prof.localPath);
                }
            }

            const discoveryInputs = [];
            for (const profile of weightSortedProfiles) {
                const localPath = earlyLocalPaths.get(profile.name);
                if (!localPath) {
                    if (verbose) {
                        p.log.warn(
                            `Profile "${profile.name}": no local path available — skipping discovery`,
                        );
                    }
                    continue;
                }
                try {
                    const discovery = await discoverProfile(localPath);
                    discoveryInputs.push({
                        discovery,
                        meta: {
                            name: profile.name,
                            profileScope: profile.manifest.scope,
                        },
                    });
                    if (discovery.warnings.length > 0 && verbose) {
                        for (const w of discovery.warnings) {
                            p.log.info(`  [discovery] ${profile.name}: ${w}`);
                        }
                    }
                } catch (error) {
                    p.log.warn(`Discovery failed for profile "${profile.name}": ${error}`);
                }
            }

            const assembled = assembleContentFromDiscovery(discoveryInputs);
            const mergedSkills: MergedSkillItem[] = assembled.skills;
            const mergedRules: RuleEntry[] = assembled.rules;
            const mergedAgents: AgentEntry[] = assembled.agents;
            const mergedMemory: MemoryEntry[] = assembled.memory;
            const discoveryCommandEntries: CommandEntry[] = assembled.commands;
            const discoverySourcePaths: Map<string, string> = assembled.sourceFilePaths;

            // Populate commandMap for the placement phase
            const commandMap = new Map<string, string>();
            for (const cmd of assembled.commands) {
                commandMap.set(cmd.name, cmd.profileName);
            }
            const mergedCommandCount = commandMap.size;

            // Files and IDE configs are no longer declared in manifests.
            // These empty maps keep the placement phase structurally intact.
            const fileMap = new Map<
                string,
                { source: string; target: string; profileName: string }
            >();
            const mergedFileCount = fileMap.size;
            const ideMap = new Map<
                string,
                { ideKey: string; fileName: string; targetDir: string; profileName: string }
            >();
            const mergedIdeCount = ideMap.size;

            spinner.stop(
                `Merged: ${mergedSkills.length} skills, ${mergedRules.length} rules, ${mergedAgents.length} agents, ${mergedMemory.length} memory files, ${mergedCommandCount} commands`,
            );

            // Step 3: Determine which AI tools and IDE platforms to sync (intersection-based)
            spinner.start("Computing tool intersection...");

            const prefs = await resolvePreferences(projectRoot);
            const detectedAITools = await detectInstalledAITools();
            const detectedIdes = await detectInstalledIdes();

            if (verbose) {
                p.log.info(
                    `AI tools: ${prefs.ai.tools.join(", ") || "(none)"} (from ${prefs.ai.source} preferences)`,
                );
                p.log.info(
                    `IDE platforms: ${prefs.ide.platforms.join(", ") || "(none)"} (from ${prefs.ide.source} preferences)`,
                );
            }

            let syncedAiTools: string[];
            let syncedIdePlatforms: string[] | null = null;
            let allIntersections: Map<string, import("@baton-dx/core").IntersectionResult> | null =
                null;

            if (prefs.ai.tools.length > 0) {
                const developerTools = {
                    aiTools: prefs.ai.tools,
                    idePlatforms: prefs.ide.platforms,
                };
                const aggregatedSyncedAi = new Set<string>();
                const aggregatedSyncedIde = new Set<string>();
                allIntersections = new Map();

                for (const profileSource of projectManifest.profiles || []) {
                    try {
                        const intersection = await buildIntersection(
                            profileSource.source,
                            developerTools,
                            projectRoot,
                        );
                        if (intersection) {
                            allIntersections.set(profileSource.source, intersection);
                            for (const tool of intersection.aiTools.synced) {
                                aggregatedSyncedAi.add(tool);
                            }
                            for (const platform of intersection.idePlatforms.synced) {
                                aggregatedSyncedIde.add(platform);
                            }
                        }
                    } catch {
                        // Best-effort — skip if intersection cannot be computed for this profile
                    }
                }

                syncedAiTools = aggregatedSyncedAi.size > 0 ? [...aggregatedSyncedAi] : [];
                syncedIdePlatforms = [...aggregatedSyncedIde];
            } else {
                syncedAiTools = detectedAITools;
                syncedIdePlatforms = null;
                if (detectedAITools.length > 0) {
                    p.log.warn(
                        "No AI tools configured. Run `baton ai-tools scan` to configure your tools.",
                    );
                    p.log.info(`Falling back to detected tools: ${detectedAITools.join(", ")}`);
                }
            }

            if (syncedAiTools.length === 0 && detectedAITools.length === 0) {
                spinner.stop("No AI tools available");
                p.cancel("No AI tools found. Install an AI coding tool first.");
                process.exit(1);
            }

            if (syncedAiTools.length === 0) {
                spinner.stop("No AI tools in intersection");
                p.cancel(
                    "No AI tools match between your configuration and profile support. " +
                        "Run `baton ai-tools scan` or check your profile's supported tools.",
                );
                process.exit(1);
            }

            if (allIntersections) {
                if (verbose) {
                    for (const [source, intersection] of allIntersections) {
                        p.log.step(`Intersection for ${source}`);
                        displayIntersection(intersection);
                    }
                } else {
                    // Deduplicate: show unique summaries only once
                    const seen = new Set<string>();
                    for (const [, intersection] of allIntersections) {
                        const summary = formatIntersectionSummary(intersection);
                        if (!seen.has(summary)) {
                            seen.add(summary);
                            p.log.info(`Applying for: ${summary}`);
                        }
                    }
                }
            }

            const ideSummary =
                syncedIdePlatforms && syncedIdePlatforms.length > 0
                    ? ` | IDE platforms: ${syncedIdePlatforms.join(", ")}`
                    : "";
            spinner.stop(`Applying to AI tools: ${syncedAiTools.join(", ")}${ideSummary}`);

            // Step 4: Migrate legacy paths
            spinner.start("Checking for legacy paths...");

            const legacyFiles = await detectLegacyPaths(projectRoot);

            if (legacyFiles.length > 0 && !dryRun) {
                spinner.stop(`Found ${legacyFiles.length} legacy file(s)`);

                if (!autoYes) {
                    p.note(
                        `Found legacy configuration files:\n${legacyFiles.map((f) => `  - ${f.legacyPath}`).join("\n")}`,
                        "Legacy Files",
                    );
                    p.log.warn(
                        "Run migration manually with appropriate action (migrate/copy/skip)",
                    );
                }
            } else {
                spinner.stop("No legacy files found");
            }

            // Step 5-7: Transform, Place, and Link
            spinner.start("Processing configurations...");

            const adapters = getAIToolAdaptersForKeys(syncedAiTools);

            const placementConfig = {
                mode: "copy" as const,
                projectRoot,
            };

            // Track placed file contents per profile for lockfile integrity hashes
            // Keys are CANONICAL paths (e.g., "skills/add-adapter", "memory/MEMORY.md")
            const placedFiles = new Map<string, Record<string, LockFileEntry>>();

            // Track ACTUAL tool-specific file paths placed on disk
            const actualPlacedPaths = new Set<string>(); // combined for orphan detection
            const aiToolPlacedPaths = new Set<string>(); // AI tool adapter placements
            const idePlacedPaths = new Set<string>(); // IDE platform placements
            const filePlacedPaths = new Set<string>(); // profile files section placements
            const includePlacedPaths = new Set<string>(); // .baton/includes/ placements
            const pendingPlacements: FilePlacement[] = [];

            // Build a map from profile name to local directory path
            const profileLocalPaths = new Map<string, string>();
            for (const profileSource of projectManifest.profiles || []) {
                const parsed = parseSource(profileSource.source);
                if (parsed.provider === "local" || parsed.provider === "file") {
                    const localPath = expandLocalPath(parsed.path, projectRoot);
                    for (const prof of allProfiles) {
                        if (prof.source === profileSource.source) {
                            profileLocalPaths.set(prof.name, localPath);
                        }
                    }
                } else if (
                    parsed.provider === "github" ||
                    parsed.provider === "gitlab" ||
                    parsed.provider === "git"
                ) {
                    // Reuse authenticated URL + token from Step 1 (avoids cache key mismatch and auth failure)
                    const cached = sourceAuth.get(profileSource.source);
                    const cloneUrl = cached?.cloneUrl ?? parsed.url;

                    // Use locked SHA for deterministic clone
                    let ref = profileSource.version;
                    if (lockfile) {
                        const packageName = getPackageNameFromSource(profileSource.source, parsed);
                        const lockedPkg = lockfile.packages[packageName];
                        if (lockedPkg?.sha && lockedPkg.sha !== "unknown") {
                            ref = lockedPkg.sha;
                        }
                    }

                    const cloned = await cloneGitSource({
                        url: cloneUrl,
                        ref,
                        subpath: "subpath" in parsed ? parsed.subpath : undefined,
                        useCache: true,
                        maxCacheAgeMs,
                        authToken: cached?.authToken,
                    });
                    for (const prof of allProfiles) {
                        if (prof.source === profileSource.source) {
                            profileLocalPaths.set(prof.name, cloned.localPath);
                        }
                    }
                }
            }

            // Register local paths for inherited profiles (from extends chains)
            for (const prof of allProfiles) {
                if (!profileLocalPaths.has(prof.name) && prof.localPath) {
                    profileLocalPaths.set(prof.name, prof.localPath);
                }
            }

            // Content accumulator for files that may receive content from multiple categories
            const contentAccumulator = new Map<
                string,
                {
                    parts: string[];
                    adapter: AIToolAdapter;
                    type: "memory" | "rules" | "agents";
                    name: string;
                    scope: Scope;
                    profiles: Set<string>;
                }
            >();

            // Accumulate memory file content
            if (!dryRun && syncAi) {
                for (const adapter of adapters) {
                    if (verbose) {
                        p.log.step(`[${adapter.key}] Placing memory files...`);
                    }
                    for (const memoryEntry of mergedMemory) {
                        try {
                            const contentParts: string[] = [];
                            for (const contribution of memoryEntry.contributions) {
                                const profileDir = profileLocalPaths.get(contribution.profileName);
                                if (!profileDir) {
                                    spinner.message(
                                        `Warning: Could not resolve local path for profile ${contribution.profileName}`,
                                    );
                                    continue;
                                }

                                const memoryFilePath = resolve(
                                    profileDir,
                                    "ai",
                                    "memory",
                                    memoryEntry.filename,
                                );
                                try {
                                    const rawContent = await readFile(memoryFilePath, "utf-8");
                                    // Process directives per-contribution with profile-relative root
                                    const processed = await processDirectives(rawContent, {
                                        context: {
                                            projectRoot,
                                            profileRoot: profileDir,
                                            profileName: contribution.profileName,
                                            currentTool: adapter.key,
                                            detectedTools: syncedAiTools,
                                            detectedIdes,
                                            scope: memoryEntry.scope,
                                            contentType: "memory",
                                        },
                                        onWarning: (msg) => {
                                            if (verbose) p.log.info(`  [directive] ${msg}`);
                                        },
                                        onPlacement: (placement) =>
                                            pendingPlacements.push(placement),
                                    });
                                    contentParts.push(processed);
                                } catch {
                                    spinner.message(`Warning: Could not read ${memoryFilePath}`);
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
                            const absolutePath = targetPath.startsWith("/")
                                ? targetPath
                                : resolve(projectRoot, targetPath);

                            const existing = contentAccumulator.get(absolutePath);
                            if (existing) {
                                existing.parts.push(transformed.content);
                                for (const c of memoryEntry.contributions)
                                    existing.profiles.add(c.profileName);
                            } else {
                                const profiles = new Set<string>();
                                for (const c of memoryEntry.contributions)
                                    profiles.add(c.profileName);
                                contentAccumulator.set(absolutePath, {
                                    parts: [transformed.content],
                                    adapter,
                                    type: "memory",
                                    name: transformed.filename,
                                    scope: memoryEntry.scope,
                                    profiles,
                                });
                            }
                        } catch (error) {
                            spinner.message(
                                `Error placing ${memoryEntry.filename} for ${adapter.name}: ${error}`,
                            );
                            stats.errors++;
                        }
                    }
                }
            }

            // Place skill directories
            if (!dryRun && syncAi) {
                for (const adapter of adapters) {
                    if (verbose) {
                        p.log.step(`[${adapter.key}] Placing skills...`);
                    }
                    for (const skillItem of mergedSkills) {
                        try {
                            const profileDir = profileLocalPaths.get(skillItem.profileName);
                            if (!profileDir) {
                                spinner.message(
                                    `Warning: Could not resolve local path for profile ${skillItem.profileName}`,
                                );
                                continue;
                            }

                            const skillSourceDir = resolve(
                                profileDir,
                                "ai",
                                "skills",
                                skillItem.name,
                            );

                            try {
                                await stat(skillSourceDir);
                            } catch {
                                spinner.message(
                                    `Warning: Skill directory not found: ${skillSourceDir}`,
                                );
                                continue;
                            }

                            const targetSkillPath = adapter.getPath(
                                "skills",
                                skillItem.scope,
                                skillItem.name,
                            );
                            const absoluteTargetDir = targetSkillPath.startsWith("/")
                                ? targetSkillPath
                                : resolve(projectRoot, targetSkillPath);

                            const skillProfileDir = profileLocalPaths.get(skillItem.profileName);
                            const skillTransform = async (content: string) =>
                                processDirectives(content, {
                                    context: {
                                        projectRoot,
                                        profileRoot: skillProfileDir,
                                        profileName: skillItem.profileName,
                                        currentTool: adapter.key,
                                        detectedTools: syncedAiTools,
                                        detectedIdes,
                                        scope: skillItem.scope,
                                        contentType: "skills",
                                    },
                                    onWarning: (msg) => {
                                        if (verbose) p.log.info(`  [directive] ${msg}`);
                                    },
                                    onPlacement: (placement) => pendingPlacements.push(placement),
                                });
                            const placed = await copyDirectoryRecursive(
                                skillSourceDir,
                                absoluteTargetDir,
                                skillTransform,
                            );
                            if (placed > 0) stats.created += placed;
                            else stats.skipped++;

                            // Track tool-specific disk path for state/orphan detection
                            actualPlacedPaths.add(targetSkillPath);
                            aiToolPlacedPaths.add(targetSkillPath);

                            // Track canonical key + source content for lockfile integrity (once per skill)
                            const canonicalKey = `skills/${skillItem.name}`;
                            const profileFiles = getOrCreatePlacedFiles(
                                placedFiles,
                                skillItem.profileName,
                            );
                            if (!profileFiles[canonicalKey]) {
                                try {
                                    const entryContent = await readFile(
                                        resolve(skillSourceDir, "index.md"),
                                        "utf-8",
                                    );
                                    profileFiles[canonicalKey] = {
                                        content: entryContent,
                                        type: "skills",
                                    };
                                } catch {
                                    profileFiles[canonicalKey] = {
                                        content: skillItem.name,
                                        type: "skills",
                                    };
                                }
                            }

                            if (verbose) {
                                const label =
                                    placed > 0 ? `${placed} file(s) created` : "unchanged, skipped";
                                p.log.info(`  -> ${absoluteTargetDir}/ (${label})`);
                            }
                        } catch (error) {
                            spinner.message(
                                `Error placing skill ${skillItem.name} for ${adapter.name}: ${error}`,
                            );
                            stats.errors++;
                        }
                    }
                }
            }

            // Accumulate rule file content
            if (!dryRun && syncAi) {
                for (const adapter of adapters) {
                    if (verbose) {
                        p.log.step(`[${adapter.key}] Placing rules...`);
                    }
                    for (const ruleEntry of mergedRules) {
                        try {
                            const ruleName = ruleEntry.name.replace(/\.md$/, "");

                            const isUniversal = ruleEntry.agents.length === 0;
                            const isForThisAdapter = ruleEntry.agents.includes(adapter.key);
                            if (!isUniversal && !isForThisAdapter) continue;

                            const profileDir = profileLocalPaths.get(ruleEntry.profileName);
                            if (!profileDir) {
                                spinner.message(
                                    `Warning: Could not resolve local path for profile ${ruleEntry.profileName}`,
                                );
                                continue;
                            }

                            const ruleSubdir = isUniversal ? "universal" : ruleEntry.agents[0];
                            const ruleSourcePath = resolve(
                                profileDir,
                                "ai",
                                "rules",
                                ruleSubdir,
                                `${ruleName}.md`,
                            );

                            let rawContent: string;
                            try {
                                rawContent = await readFile(ruleSourcePath, "utf-8");
                            } catch {
                                spinner.message(
                                    `Warning: Could not read rule file: ${ruleSourcePath}`,
                                );
                                continue;
                            }

                            // Process directives per-contribution with profile-relative root
                            rawContent = await processDirectives(rawContent, {
                                context: {
                                    projectRoot,
                                    profileRoot: profileDir,
                                    profileName: ruleEntry.profileName,
                                    currentTool: adapter.key,
                                    detectedTools: syncedAiTools,
                                    detectedIdes,
                                    scope: ruleEntry.scope,
                                    contentType: "rules",
                                },
                                onWarning: (msg) => {
                                    if (verbose) p.log.info(`  [directive] ${msg}`);
                                },
                                onPlacement: (placement) => pendingPlacements.push(placement),
                            });

                            const parsed = parseFrontmatter(rawContent);

                            const ruleFile: RuleFile = {
                                name: ruleName,
                                content: rawContent,
                                frontmatter:
                                    Object.keys(parsed.data).length > 0
                                        ? (parsed.data as RuleFile["frontmatter"])
                                        : undefined,
                            };

                            const transformed = adapter.transformRule(ruleFile);

                            const targetPath = adapter.getPath("rules", ruleEntry.scope, ruleName);
                            const absolutePath = targetPath.startsWith("/")
                                ? targetPath
                                : resolve(projectRoot, targetPath);

                            const existing = contentAccumulator.get(absolutePath);
                            if (existing) {
                                existing.parts.push(transformed.content);
                                existing.profiles.add(ruleEntry.profileName);
                            } else {
                                contentAccumulator.set(absolutePath, {
                                    parts: [transformed.content],
                                    adapter,
                                    type: "rules",
                                    name: ruleName,
                                    scope: ruleEntry.scope,
                                    profiles: new Set([ruleEntry.profileName]),
                                });
                            }
                        } catch (error) {
                            spinner.message(
                                `Error placing rule ${ruleEntry.name} for ${adapter.name}: ${error}`,
                            );
                            stats.errors++;
                        }
                    }
                }
            }

            // Accumulate agent file content
            if (!dryRun && syncAi) {
                for (const adapter of adapters) {
                    if (verbose) {
                        p.log.step(`[${adapter.key}] Placing agents...`);
                    }
                    for (const agentEntry of mergedAgents) {
                        try {
                            const agentName = agentEntry.name.replace(/\.md$/, "");

                            const isUniversal = agentEntry.agents.length === 0;
                            const isForThisAdapter = agentEntry.agents.includes(adapter.key);
                            if (!isUniversal && !isForThisAdapter) continue;

                            const profileDir = profileLocalPaths.get(agentEntry.profileName);
                            if (!profileDir) {
                                spinner.message(
                                    `Warning: Could not resolve local path for profile ${agentEntry.profileName}`,
                                );
                                continue;
                            }

                            const agentSubdir = isUniversal ? "universal" : agentEntry.agents[0];
                            const agentSourcePath = resolve(
                                profileDir,
                                "ai",
                                "agents",
                                agentSubdir,
                                `${agentName}.md`,
                            );

                            let rawContent: string;
                            try {
                                rawContent = await readFile(agentSourcePath, "utf-8");
                            } catch {
                                spinner.message(
                                    `Warning: Could not read agent file: ${agentSourcePath}`,
                                );
                                continue;
                            }

                            // Process directives per-contribution with profile-relative root
                            rawContent = await processDirectives(rawContent, {
                                context: {
                                    projectRoot,
                                    profileRoot: profileDir,
                                    profileName: agentEntry.profileName,
                                    currentTool: adapter.key,
                                    detectedTools: syncedAiTools,
                                    detectedIdes,
                                    scope: agentEntry.scope,
                                    contentType: "agents",
                                },
                                onWarning: (msg) => {
                                    if (verbose) p.log.info(`  [directive] ${msg}`);
                                },
                                onPlacement: (placement) => pendingPlacements.push(placement),
                            });

                            const parsed = parseFrontmatter(rawContent);

                            const frontmatter =
                                Object.keys(parsed.data).length > 0
                                    ? (parsed.data as AgentFile["frontmatter"])
                                    : { name: agentName };
                            const agentFile: AgentFile = {
                                name: agentName,
                                content: rawContent,
                                description: (frontmatter as Record<string, unknown>).description as
                                    | string
                                    | undefined,
                                frontmatter,
                            };

                            const transformed = adapter.transformAgent(agentFile);

                            const targetPath = adapter.getPath(
                                "agents",
                                agentEntry.scope,
                                agentName,
                            );
                            const absolutePath = targetPath.startsWith("/")
                                ? targetPath
                                : resolve(projectRoot, targetPath);

                            const existing = contentAccumulator.get(absolutePath);
                            if (existing) {
                                existing.parts.push(transformed.content);
                                existing.profiles.add(agentEntry.profileName);
                            } else {
                                contentAccumulator.set(absolutePath, {
                                    parts: [transformed.content],
                                    adapter,
                                    type: "agents",
                                    name: agentName,
                                    scope: agentEntry.scope,
                                    profiles: new Set([agentEntry.profileName]),
                                });
                            }
                        } catch (error) {
                            spinner.message(
                                `Error placing agent ${agentEntry.name} for ${adapter.name}: ${error}`,
                            );
                            stats.errors++;
                        }
                    }
                }
            }

            // Flush accumulated content
            if (!dryRun && syncAi) {
                for (const [absolutePath, entry] of contentAccumulator) {
                    try {
                        // Directives already processed per-contribution before merging
                        const finalContent = normalizeMarkdown(entry.parts.join("\n\n"));
                        const result = await placeFile(
                            finalContent,
                            entry.adapter,
                            entry.type,
                            entry.scope,
                            entry.name,
                            placementConfig,
                        );

                        // Track stats by action type
                        if (result.action === "created") stats.created++;
                        else if (result.action === "updated") stats.updated++;
                        else stats.skipped++;

                        // Track tool-specific disk path for state/orphan detection
                        const relPath = isAbsolute(result.path)
                            ? relative(projectRoot, result.path)
                            : result.path;
                        actualPlacedPaths.add(relPath);
                        aiToolPlacedPaths.add(relPath);

                        // Track canonical key + source content for lockfile integrity
                        const canonicalKey = `${entry.type}/${entry.name}`;
                        for (const profileName of entry.profiles) {
                            const pf = getOrCreatePlacedFiles(placedFiles, profileName);
                            if (!pf[canonicalKey]) {
                                pf[canonicalKey] = {
                                    content: finalContent,
                                    type: entry.type as LockFileEntry["type"],
                                };
                            }
                        }

                        if (verbose) {
                            stats.details.push({ path: relPath, action: result.action });
                            const label =
                                result.action === "skipped" ? "unchanged, skipped" : result.action;
                            p.log.info(`  -> ${result.path} (${label})`);
                        }
                    } catch (error) {
                        spinner.message(
                            `Error placing accumulated content to ${absolutePath}: ${error}`,
                        );
                        stats.errors++;
                    }
                }
            }

            // Place command files (from discovery)
            if (!dryRun && syncAi) {
                for (const adapter of adapters) {
                    if (verbose) {
                        p.log.step(`[${adapter.key}] Placing commands...`);
                    }
                    for (const cmdEntry of discoveryCommandEntries) {
                        try {
                            // Resolve source path from discovery
                            const discoveredCmdPath = discoverySourcePaths.get(
                                `commands/${cmdEntry.name}`,
                            );
                            let commandSourcePath: string;
                            if (discoveredCmdPath) {
                                commandSourcePath = discoveredCmdPath;
                            } else {
                                const profileDir = profileLocalPaths.get(cmdEntry.profileName);
                                if (!profileDir) continue;
                                commandSourcePath = resolve(
                                    profileDir,
                                    "ai",
                                    "commands",
                                    `${cmdEntry.name}.md`,
                                );
                            }

                            const cmdProfileDir = profileLocalPaths.get(cmdEntry.profileName);

                            let content: string;
                            try {
                                content = await readFile(commandSourcePath, "utf-8");
                            } catch {
                                continue;
                            }

                            const finalContent = await processDirectives(content, {
                                context: {
                                    projectRoot,
                                    profileRoot: cmdProfileDir,
                                    profileName: cmdEntry.profileName,
                                    currentTool: adapter.key,
                                    detectedTools: syncedAiTools,
                                    detectedIdes,
                                    scope: cmdEntry.scope,
                                    contentType: "commands",
                                },
                                onWarning: (msg) => {
                                    if (verbose) p.log.info(`  [directive] ${msg}`);
                                },
                                onPlacement: (placement) => pendingPlacements.push(placement),
                            });

                            const result = await placeFile(
                                finalContent,
                                adapter,
                                "commands",
                                cmdEntry.scope,
                                cmdEntry.name,
                                placementConfig,
                            );

                            // Track stats by action type
                            if (result.action === "created") stats.created++;
                            else if (result.action === "updated") stats.updated++;
                            else stats.skipped++;

                            // Track tool-specific disk path for state/orphan detection
                            const cmdRelPath = isAbsolute(result.path)
                                ? relative(projectRoot, result.path)
                                : result.path;
                            actualPlacedPaths.add(cmdRelPath);
                            aiToolPlacedPaths.add(cmdRelPath);

                            // Track canonical key + source content for lockfile (once per command)
                            const canonicalKey = `commands/${cmdEntry.name}`;
                            const pf = getOrCreatePlacedFiles(placedFiles, cmdEntry.profileName);
                            if (!pf[canonicalKey]) {
                                pf[canonicalKey] = { content: finalContent, type: "commands" };
                            }

                            if (verbose) {
                                stats.details.push({
                                    path: cmdRelPath,
                                    action: result.action,
                                });
                                const label =
                                    result.action === "skipped"
                                        ? "unchanged, skipped"
                                        : result.action;
                                p.log.info(`  -> ${result.path} (${label})`);
                            }
                        } catch (error) {
                            spinner.message(
                                `Error placing command ${cmdEntry.name} for ${adapter.name}: ${error}`,
                            );
                            stats.errors++;
                        }
                    }
                }
            }

            // Place project files
            if (!dryRun && syncFiles) {
                for (const fileEntry of fileMap.values()) {
                    try {
                        const profileDir = profileLocalPaths.get(fileEntry.profileName);
                        if (!profileDir) continue;

                        const fileSourcePath = resolve(profileDir, "files", fileEntry.source);

                        let content: string;
                        try {
                            content = await readFile(fileSourcePath, "utf-8");
                        } catch {
                            continue;
                        }

                        const targetPath = resolve(projectRoot, fileEntry.target);

                        await mkdir(dirname(targetPath), { recursive: true });

                        const existing = await readFile(targetPath, "utf-8").catch(() => undefined);
                        const fileAction =
                            existing === undefined
                                ? "created"
                                : existing !== content
                                  ? "updated"
                                  : "skipped";
                        if (fileAction !== "skipped") {
                            await atomicWriteFile(targetPath, content);
                        }
                        if (fileAction === "created") stats.created++;
                        else if (fileAction === "updated") stats.updated++;
                        else stats.skipped++;
                        if (verbose) {
                            stats.details.push({
                                path: fileEntry.target,
                                action: fileAction,
                            });
                            const label =
                                fileAction === "skipped" ? "unchanged, skipped" : fileAction;
                            p.log.info(`  -> ${fileEntry.target} (${label})`);
                        }

                        // Track disk path for state/orphan detection
                        actualPlacedPaths.add(fileEntry.target);
                        filePlacedPaths.add(fileEntry.target);

                        // Track canonical key for lockfile integrity
                        const canonicalKey = `files/${fileEntry.target}`;
                        const fpf = getOrCreatePlacedFiles(placedFiles, fileEntry.profileName);
                        if (!fpf[canonicalKey]) {
                            fpf[canonicalKey] = { content, type: "files" };
                        }
                    } catch (error) {
                        spinner.message(`Error placing file ${fileEntry.source}: ${error}`);
                        stats.errors++;
                    }
                }
            }

            // Place IDE config files
            if (!dryRun && syncIde) {
                for (const ideEntry of ideMap.values()) {
                    try {
                        if (
                            syncedIdePlatforms !== null &&
                            !syncedIdePlatforms.includes(ideEntry.ideKey)
                        ) {
                            if (verbose) {
                                p.log.info(
                                    `  -> ${ideEntry.targetDir}/${ideEntry.fileName} (skipped — IDE platform "${ideEntry.ideKey}" not in intersection)`,
                                );
                            }
                            continue;
                        }

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

                        const targetPath = resolve(
                            projectRoot,
                            ideEntry.targetDir,
                            ideEntry.fileName,
                        );

                        await mkdir(dirname(targetPath), { recursive: true });

                        const existing = await readFile(targetPath, "utf-8").catch(() => undefined);
                        const ideAction =
                            existing === undefined
                                ? "created"
                                : existing !== content
                                  ? "updated"
                                  : "skipped";
                        if (ideAction !== "skipped") {
                            await atomicWriteFile(targetPath, content);
                        }
                        if (ideAction === "created") stats.created++;
                        else if (ideAction === "updated") stats.updated++;
                        else stats.skipped++;

                        // Track disk path for state/orphan detection
                        const ideRelPath = `${ideEntry.targetDir}/${ideEntry.fileName}`;

                        if (verbose) {
                            stats.details.push({ path: ideRelPath, action: ideAction });
                            const label =
                                ideAction === "skipped" ? "unchanged, skipped" : ideAction;
                            p.log.info(`  -> ${ideRelPath} (${label})`);
                        }
                        actualPlacedPaths.add(ideRelPath);
                        idePlacedPaths.add(ideRelPath);

                        // Track canonical key for lockfile integrity
                        const canonicalKey = `ide/${ideEntry.ideKey}/${ideEntry.fileName}`;
                        const ipf = getOrCreatePlacedFiles(placedFiles, ideEntry.profileName);
                        if (!ipf[canonicalKey]) {
                            ipf[canonicalKey] = { content, type: "ide" };
                        }
                    } catch (error) {
                        spinner.message(`Error placing IDE config ${ideEntry.fileName}: ${error}`);
                        stats.errors++;
                    }
                }
            }

            spinner.stop(
                dryRun
                    ? `Would place files for ${adapters.length} agent(s)`
                    : `Placed files for ${adapters.length} agent(s)`,
            );

            // Step 8: Update .gitignore
            if (!dryRun) {
                await handleGitignoreUpdate({
                    projectManifest,
                    projectRoot,
                    spinner,
                });
            }

            // Step 9: Write lockfile (canonical keys, tool-agnostic)
            if (!dryRun) {
                await writeLockData({
                    allProfiles,
                    sourceShas,
                    placedFiles,
                    projectRoot,
                    spinner,
                    batonVersion: currentVersion,
                });
            }

            // Copy placement files (.baton/includes/)
            if (!dryRun && pendingPlacements.length > 0) {
                spinner.start("Copying referenced files...");
                const seen = new Set<string>();
                for (const placement of pendingPlacements) {
                    if (seen.has(placement.targetRelative)) continue;
                    seen.add(placement.targetRelative);
                    const targetAbsolute = resolve(projectRoot, placement.targetRelative);
                    await mkdir(dirname(targetAbsolute), { recursive: true });
                    await copyFile(placement.sourcePath, targetAbsolute);
                    actualPlacedPaths.add(placement.targetRelative);
                    includePlacedPaths.add(placement.targetRelative);
                }
                spinner.stop(`Copied ${seen.size} referenced file(s)`);
            }

            // Step 9b: Write local state (tool-specific disk paths, never committed)
            if (!dryRun) {
                await writeStateData({
                    aiToolPaths: aiToolPlacedPaths,
                    idePaths: idePlacedPaths,
                    filePaths: filePlacedPaths,
                    includePaths: includePlacedPaths,
                    syncedAiTools,
                    projectRoot,
                    spinner,
                });
            }

            // Step 9c: Execute profile hooks
            if (!dryRun) {
                for (const profile of allProfiles) {
                    if (!profile.manifest.hooks) continue;
                    const isFirstSync = previousPaths.size === 0;
                    const hookType = isFirstSync ? "post-install" : "post-update";
                    const hookCommand = profile.manifest.hooks[hookType];
                    if (hookCommand) {
                        await runProfileHook({
                            command: hookCommand,
                            profileName: profile.name,
                            hookType,
                            projectRoot,
                            spinner,
                        });
                    }
                }
            }

            // Step 10: Remove orphaned files (comparing tool-specific disk paths)
            const removedCount = await cleanupOrphanedFiles({
                previousPaths,
                currentPaths: actualPlacedPaths,
                projectRoot,
                dryRun,
                autoYes,
                spinner,
            });
            stats.removed = removedCount;

            // Summary
            if (dryRun) {
                const parts: string[] = [];
                if (syncAi) {
                    parts.push(`  • ${mergedSkills.length} skills`);
                    parts.push(`  • ${mergedRules.length} rules`);
                    parts.push(`  • ${mergedAgents.length} agents`);
                    parts.push(`  • ${mergedMemory.length} memory files`);
                    parts.push(`  • ${mergedCommandCount} commands`);
                }
                if (syncFiles) {
                    parts.push(`  • ${mergedFileCount} files`);
                }
                if (syncIde) {
                    const filteredIdeCount =
                        syncedIdePlatforms !== null
                            ? [...ideMap.values()].filter((e) =>
                                  syncedIdePlatforms.includes(e.ideKey),
                              ).length
                            : mergedIdeCount;
                    parts.push(`  • ${filteredIdeCount} IDE configs`);
                }
                const categoryLabel = category ? ` (category: ${category})` : "";
                p.outro(
                    `[Dry Run${categoryLabel}] Would apply:\n${parts.join("\n")}\n\nFor ${adapters.length} agent(s): ${syncedAiTools.join(", ")}`,
                );
            } else {
                const categoryLabel = category ? ` (category: ${category})` : "";
                p.outro(`Apply complete${categoryLabel}: ${formatSyncReport(stats, verbose)}`);
            }

            process.exit(stats.errors > 0 ? 1 : 0);
        } catch (error) {
            p.cancel(`Apply failed: ${error}`);
            process.exit(1);
        }
    },
});
