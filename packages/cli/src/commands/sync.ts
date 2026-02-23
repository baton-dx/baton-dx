import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import {
  type AIToolAdapter,
  type AgentEntry,
  type AgentFile,
  type CloneContext,
  FileNotFoundError,
  type LockFileEntry,
  type MemoryEntry,
  type MergedSkillItem,
  type ProjectManifest,
  type RuleEntry,
  type RuleFile,
  type WeightConflictWarning,
  cloneGitSource,
  detectInstalledAITools,
  detectLegacyPaths,
  getAIToolAdaptersForKeys,
  getIdePlatformTargetDir,
  getProfileWeight,
  isKnownIdePlatform,
  isLockedProfile,
  loadProfileManifest,
  loadProjectManifest,
  mergeAgentsWithWarnings,
  mergeContentParts,
  mergeMemoryWithWarnings,
  mergeRulesWithWarnings,
  mergeSkillsWithWarnings,
  parseFrontmatter,
  parseSource,
  placeFile,
  resolveNpmSource,
  resolvePreferences,
  resolveProfileChain,
  resolveVersion,
  sortProfilesByWeight,
} from "@baton-dx/core";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import simpleGit from "simple-git";
import { buildIntersection } from "../utils/build-intersection.js";
import { promptFirstRunPreferences } from "../utils/first-run-preferences.js";
import { displayIntersection, formatIntersectionSummary } from "../utils/intersection-display.js";
import {
  type SyncCategory,
  type SyncStats,
  cleanupOrphanedFiles,
  copyDirectoryRecursive,
  getOrCreatePlacedFiles,
  handleGitignoreUpdate,
  loadPreviousPlacedPaths,
  validCategories,
  writeLockData,
  writeStateData,
} from "./sync-pipeline.js";

export const syncCommand = defineCommand({
  meta: {
    name: "sync",
    description: "Fetch latest versions, sync all configurations, and update lockfile",
  },
  args: {
    "dry-run": {
      type: "boolean",
      description: "Show what would be done without writing files",
      default: false,
    },
    category: {
      type: "string",
      description: "Sync only a specific category: ai, files, or ide",
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
  },
  async run({ args }) {
    const dryRun = args["dry-run"];
    const categoryArg = args.category as string | undefined;
    const autoYes = args.yes;
    const verbose = args.verbose;

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

    p.intro(category ? `🔄 Baton Sync (category: ${category})` : "🔄 Baton Sync");

    // Statistics tracking
    const stats: SyncStats = {
      created: 0,
      errors: 0,
    };

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

      // Step 0b: Read previous placement state to detect orphaned files later
      // Uses .baton/state.yaml (preferred) or falls back to old lockfile keys (legacy migration)
      const previousPaths = await loadPreviousPlacedPaths(projectRoot);

      // Step 1: Resolve profile chain
      const spinner = p.spinner();
      spinner.start("Resolving profile chain...");

      const allProfiles = [];
      // Track SHA per source for lockfile
      const sourceShas = new Map<string, string>();
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
            const absolutePath = parsed.path.startsWith("/")
              ? parsed.path
              : resolve(projectRoot, parsed.path);
            manifestPath = resolve(absolutePath, "baton.profile.yaml");
            // Try to get SHA from local git repo, fallback to "local"
            try {
              const git = simpleGit(absolutePath);
              await git.checkIsRepo();
              const sha = await git.revparse(["HEAD"]);
              sourceShas.set(profileSource.source, sha.trim());
            } catch {
              sourceShas.set(profileSource.source, "local");
            }
          } else if (parsed.provider === "npm") {
            // NPM source: resolve via npm-resolver with fresh install
            const resolved = await resolveNpmSource({
              source: parsed,
              basePath: projectRoot,
              useCache: false, // Always fetch fresh for sync
            });
            manifestPath = resolve(resolved.localPath, "baton.profile.yaml");
            sourceShas.set(profileSource.source, resolved.version);
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

            // Always resolve to latest version
            let resolvedRef: string;
            try {
              resolvedRef = await resolveVersion(url, "latest");
              if (verbose) {
                p.log.info(
                  `Resolved latest: ${profileSource.source} → ${resolvedRef.slice(0, 12)}`,
                );
              }
            } catch {
              // Fallback to profileSource.version if resolution fails
              resolvedRef = profileSource.version || "HEAD";
              if (verbose) {
                p.log.warn(`Could not resolve latest for ${url}, using ${resolvedRef}`);
              }
            }

            const cloned = await cloneGitSource({
              url,
              ref: resolvedRef,
              subpath: "subpath" in parsed ? parsed.subpath : undefined,
              useCache: false,
            });
            manifestPath = resolve(cloned.localPath, "baton.profile.yaml");
            sourceShas.set(profileSource.source, cloned.sha);
            cloneContext = {
              cachePath: cloned.cachePath,
              sparseCheckout: cloned.sparseCheckout,
            };
          }

          const manifest = await loadProfileManifest(manifestPath);
          const profileDir = dirname(manifestPath);
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
        p.outro("Nothing to sync. Run `baton manage` to add a profile.");
        process.exit(2);
      }

      spinner.stop(`Resolved ${allProfiles.length} profile(s)`);

      // Step 1b: Sort profiles by weight for merge ordering
      // Higher-weight profiles appear later → win in "last-wins" merge logic
      // Stable sort preserves declaration order for same-weight profiles
      const weightSortedProfiles = sortProfilesByWeight(allProfiles);

      // Step 2: Merge configurations
      spinner.start("Merging configurations...");

      // Collect all weight conflict warnings across merge operations
      const allWeightWarnings: WeightConflictWarning[] = [];

      const skillsResult = mergeSkillsWithWarnings(weightSortedProfiles);
      const mergedSkills: MergedSkillItem[] = skillsResult.skills;
      allWeightWarnings.push(...skillsResult.warnings);

      const rulesResult = mergeRulesWithWarnings(weightSortedProfiles);
      const mergedRules: RuleEntry[] = rulesResult.rules;
      allWeightWarnings.push(...rulesResult.warnings);

      const agentsResult = mergeAgentsWithWarnings(weightSortedProfiles);
      const mergedAgents: AgentEntry[] = agentsResult.agents;
      allWeightWarnings.push(...agentsResult.warnings);

      const memoryResult = mergeMemoryWithWarnings(weightSortedProfiles);
      const mergedMemory: MemoryEntry[] = memoryResult.entries;
      allWeightWarnings.push(...memoryResult.warnings);

      // Collect all commands from all profiles (deduplicated by name, last wins)
      // Respects weight lock: commands from weight -1 profiles cannot be overridden
      const commandMap = new Map<string, string>();
      const lockedCommands = new Set<string>();
      const commandOwner = new Map<string, { profileName: string; weight: number }>();
      for (const profile of weightSortedProfiles) {
        const weight = getProfileWeight(profile);
        const locked = isLockedProfile(profile);
        for (const cmd of profile.manifest.ai?.commands || []) {
          if (lockedCommands.has(cmd)) continue;

          const existing = commandOwner.get(cmd);
          if (existing && existing.weight === weight && existing.profileName !== profile.name) {
            allWeightWarnings.push({
              key: cmd,
              category: "command",
              profileA: existing.profileName,
              profileB: profile.name,
              weight,
            });
          }

          commandMap.set(cmd, profile.name);
          commandOwner.set(cmd, { profileName: profile.name, weight });
          if (locked) lockedCommands.add(cmd);
        }
      }
      const mergedCommandCount = commandMap.size;

      // Collect all files from all profiles (deduplicated by target path, last wins)
      // Respects weight lock: files from weight -1 profiles cannot be overridden
      const fileMap = new Map<string, { source: string; target: string; profileName: string }>();
      const lockedFiles = new Set<string>();
      const fileOwner = new Map<string, { profileName: string; weight: number }>();
      for (const profile of weightSortedProfiles) {
        const weight = getProfileWeight(profile);
        const locked = isLockedProfile(profile);
        for (const fileConfig of profile.manifest.files || []) {
          const target = fileConfig.target || fileConfig.source;
          if (lockedFiles.has(target)) continue;

          const existing = fileOwner.get(target);
          if (existing && existing.weight === weight && existing.profileName !== profile.name) {
            allWeightWarnings.push({
              key: target,
              category: "file",
              profileA: existing.profileName,
              profileB: profile.name,
              weight,
            });
          }

          fileMap.set(target, { source: fileConfig.source, target, profileName: profile.name });
          fileOwner.set(target, { profileName: profile.name, weight });
          if (locked) lockedFiles.add(target);
        }
      }
      const mergedFileCount = fileMap.size;

      // Collect all IDE configs from all profiles (deduplicated by target path, last wins)
      // Uses central IDE platform registry for key → directory mapping
      // Respects weight lock: IDE configs from weight -1 profiles cannot be overridden
      const ideMap = new Map<
        string,
        { ideKey: string; fileName: string; targetDir: string; profileName: string }
      >();
      const lockedIdeConfigs = new Set<string>();
      const ideOwner = new Map<string, { profileName: string; weight: number }>();
      for (const profile of weightSortedProfiles) {
        if (!profile.manifest.ide) continue;
        const weight = getProfileWeight(profile);
        const locked = isLockedProfile(profile);
        for (const [ideKey, files] of Object.entries(profile.manifest.ide)) {
          if (!files) continue;
          const targetDir = getIdePlatformTargetDir(ideKey);
          if (!targetDir) {
            if (!isKnownIdePlatform(ideKey)) {
              p.log.warn(
                `Unknown IDE platform "${ideKey}" in profile "${profile.name}" — skipping. Register it in the IDE platform registry.`,
              );
            }
            continue;
          }
          for (const fileName of files) {
            const targetPath = `${targetDir}/${fileName}`;
            if (lockedIdeConfigs.has(targetPath)) continue;

            const existing = ideOwner.get(targetPath);
            if (existing && existing.weight === weight && existing.profileName !== profile.name) {
              allWeightWarnings.push({
                key: targetPath,
                category: "ide",
                profileA: existing.profileName,
                profileB: profile.name,
                weight,
              });
            }

            ideMap.set(targetPath, { ideKey, fileName, targetDir, profileName: profile.name });
            ideOwner.set(targetPath, { profileName: profile.name, weight });
            if (locked) lockedIdeConfigs.add(targetPath);
          }
        }
      }
      const mergedIdeCount = ideMap.size;

      spinner.stop(
        `Merged: ${mergedSkills.length} skills, ${mergedRules.length} rules, ${mergedAgents.length} agents, ${mergedMemory.length} memory files, ${mergedCommandCount} commands, ${mergedFileCount} files, ${mergedIdeCount} IDE configs`,
      );

      // Emit weight conflict warnings (same weight, conflicting values)
      if (allWeightWarnings.length > 0) {
        for (const w of allWeightWarnings) {
          p.log.warn(
            `Weight conflict: "${w.profileA}" and "${w.profileB}" both define ${w.category} "${w.key}" with weight ${w.weight}. Last declared wins.`,
          );
        }
      }

      // Step 3: Determine which AI tools and IDE platforms to sync (intersection-based)
      spinner.start("Computing tool intersection...");

      const prefs = await resolvePreferences(projectRoot);
      const detectedAITools = await detectInstalledAITools();

      if (verbose) {
        p.log.info(
          `AI tools: ${prefs.ai.tools.join(", ") || "(none)"} (from ${prefs.ai.source} preferences)`,
        );
        p.log.info(
          `IDE platforms: ${prefs.ide.platforms.join(", ") || "(none)"} (from ${prefs.ide.source} preferences)`,
        );
      }

      // Compute aggregated intersection across all profiles
      // A tool/platform is "synced" if the developer has it AND at least one profile supports it
      let syncedAiTools: string[];
      let syncedIdePlatforms: string[] | null = null;
      let allIntersections: Map<string, import("@baton-dx/core").IntersectionResult> | null = null;

      if (prefs.ai.tools.length > 0) {
        const developerTools = { aiTools: prefs.ai.tools, idePlatforms: prefs.ide.platforms };
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
        // No global config — fall back to detected agents for backward compatibility
        syncedAiTools = detectedAITools;
        // No IDE filtering when no global config exists (place all IDE files)
        syncedIdePlatforms = null;
        if (detectedAITools.length > 0) {
          p.log.warn("No AI tools configured. Run `baton ai-tools scan` to configure your tools.");
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

      // Show intersection or synced tools
      if (allIntersections) {
        for (const [source, intersection] of allIntersections) {
          if (verbose) {
            p.log.step(`Intersection for ${source}`);
            displayIntersection(intersection);
          } else {
            const summary = formatIntersectionSummary(intersection);
            p.log.info(`Syncing for: ${summary}`);
          }
        }
      }

      const ideSummary =
        syncedIdePlatforms && syncedIdePlatforms.length > 0
          ? ` | IDE platforms: ${syncedIdePlatforms.join(", ")}`
          : "";
      spinner.stop(`Syncing AI tools: ${syncedAiTools.join(", ")}${ideSummary}`);

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
          p.log.warn("Run migration manually with appropriate action (migrate/copy/skip)");
        }
      } else {
        spinner.stop("No legacy files found");
      }

      // Step 5-7: Transform, Place, and Link
      spinner.start("Processing configurations...");

      // Use intersection-filtered AI tools instead of all detected agents
      const adapters = getAIToolAdaptersForKeys(syncedAiTools);

      // Placement configuration
      const placementConfig = {
        mode: "copy" as const, // Start with copy mode (symlink can be added later)
        projectRoot,
      };

      // Track placed file contents per profile for lockfile integrity hashes
      // Keys are CANONICAL paths (e.g., "skills/add-adapter", "memory/MEMORY.md")
      // Content is the SOURCE content (before tool transformation) for deterministic hashes
      const placedFiles = new Map<string, Record<string, LockFileEntry>>();

      // Track ACTUAL tool-specific file paths placed on disk (e.g., ".claude/skills/add-adapter")
      // Used for state.yaml and orphan detection — never written to lockfile
      const actualPlacedPaths = new Set<string>();

      // Build a map from profile name to local directory path
      // This is needed because profile.source may be a remote URL (e.g., "github:org/repo/subpath")
      const profileLocalPaths = new Map<string, string>();
      for (const profileSource of projectManifest.profiles || []) {
        const parsed = parseSource(profileSource.source);
        if (parsed.provider === "local" || parsed.provider === "file") {
          const localPath = parsed.path.startsWith("/")
            ? parsed.path
            : resolve(projectRoot, parsed.path);
          // Discover which profile name lives at this path
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
          const url = parsed.provider === "git" ? parsed.url : parsed.url;

          // Use the already-resolved SHA from sourceShas (resolved in Step 1)
          const resolvedSha = sourceShas.get(profileSource.source);

          const cloned = await cloneGitSource({
            url,
            ref: resolvedSha || profileSource.version,
            subpath: "subpath" in parsed ? parsed.subpath : undefined,
            useCache: true,
          });
          for (const prof of allProfiles) {
            if (prof.source === profileSource.source) {
              profileLocalPaths.set(prof.name, cloned.localPath);
            }
          }
        } else if (parsed.provider === "npm") {
          const resolved = await resolveNpmSource({
            source: parsed,
            basePath: projectRoot,
            useCache: true, // Reuse cached package for file placement
          });
          for (const prof of allProfiles) {
            if (prof.source === profileSource.source) {
              profileLocalPaths.set(prof.name, resolved.localPath);
            }
          }
        }
      }

      // Register local paths for inherited profiles (from extends chains)
      // These profiles are not in baton.yaml but were resolved via resolveProfileChain
      for (const prof of allProfiles) {
        if (!profileLocalPaths.has(prof.name) && prof.localPath) {
          profileLocalPaths.set(prof.name, prof.localPath);
        }
      }

      // Content accumulator for files that may receive content from multiple categories
      // (e.g., GitHub Copilot uses .github/copilot-instructions.md for both memory AND rules)
      // Key: absolute target path, Value: { parts, adapter, profiles }
      const contentAccumulator = new Map<
        string,
        {
          parts: string[];
          adapter: AIToolAdapter;
          type: "memory" | "rules" | "agents";
          name: string;
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
              // Read content from all contributing profiles
              const contentParts: string[] = [];
              for (const contribution of memoryEntry.contributions) {
                const profileDir = profileLocalPaths.get(contribution.profileName);
                if (!profileDir) {
                  spinner.message(
                    `Warning: Could not resolve local path for profile ${contribution.profileName}`,
                  );
                  continue;
                }

                const memoryFilePath = resolve(profileDir, "ai", "memory", memoryEntry.filename);
                try {
                  const content = await readFile(memoryFilePath, "utf-8");
                  contentParts.push(content);
                } catch {
                  spinner.message(`Warning: Could not read ${memoryFilePath}`);
                }
              }

              if (contentParts.length === 0) continue;

              // Merge content according to strategy
              const mergedContent = mergeContentParts(contentParts, memoryEntry.mergeStrategy);

              // Transform memory file for this adapter
              const transformed = adapter.transformMemory({
                filename: memoryEntry.filename,
                content: mergedContent,
              });

              // Compute target path to detect shared file destinations
              const targetPath = adapter.getPath("memory", "project", transformed.filename);
              const absolutePath = targetPath.startsWith("/")
                ? targetPath
                : resolve(projectRoot, targetPath);

              // Accumulate content for this target path
              const existing = contentAccumulator.get(absolutePath);
              if (existing) {
                existing.parts.push(transformed.content);
                for (const c of memoryEntry.contributions) existing.profiles.add(c.profileName);
              } else {
                const profiles = new Set<string>();
                for (const c of memoryEntry.contributions) profiles.add(c.profileName);
                contentAccumulator.set(absolutePath, {
                  parts: [transformed.content],
                  adapter,
                  type: "memory",
                  name: transformed.filename,
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

              const skillSourceDir = resolve(profileDir, "ai", "skills", skillItem.name);

              // Check if skill directory exists
              try {
                await stat(skillSourceDir);
              } catch {
                spinner.message(`Warning: Skill directory not found: ${skillSourceDir}`);
                continue;
              }

              // Resolve target skill directory
              const targetSkillPath = adapter.getPath("skills", skillItem.scope, skillItem.name);
              const absoluteTargetDir = targetSkillPath.startsWith("/")
                ? targetSkillPath
                : resolve(projectRoot, targetSkillPath);

              // Recursively copy skill files
              const placed = await copyDirectoryRecursive(skillSourceDir, absoluteTargetDir);
              stats.created += placed;

              // Track tool-specific disk path for state/orphan detection
              actualPlacedPaths.add(targetSkillPath);

              // Track canonical key + source content for lockfile integrity (once per skill, not per adapter)
              const canonicalKey = `skills/${skillItem.name}`;
              const profileFiles = getOrCreatePlacedFiles(placedFiles, skillItem.profileName);
              if (!profileFiles[canonicalKey]) {
                try {
                  const entryContent = await readFile(resolve(skillSourceDir, "index.md"), "utf-8");
                  profileFiles[canonicalKey] = { content: entryContent, type: "skills" };
                } catch {
                  profileFiles[canonicalKey] = { content: skillItem.name, type: "skills" };
                }
              }

              if (verbose) {
                const label = placed > 0 ? `${placed} file(s) created` : "unchanged, skipped";
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
              // Normalize: strip .md extension to prevent double-extension bug
              // (manifest may declare "coding-standards.md", path template appends ".md" again)
              const ruleName = ruleEntry.name.replace(/\.md$/, "");

              // Check if this rule should be placed for this adapter
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

              // Determine source file path based on rule type
              const ruleSubdir = isUniversal ? "universal" : ruleEntry.agents[0];
              const ruleSourcePath = resolve(
                profileDir,
                "ai",
                "rules",
                ruleSubdir,
                `${ruleName}.md`,
              );

              // Read rule content
              let rawContent: string;
              try {
                rawContent = await readFile(ruleSourcePath, "utf-8");
              } catch {
                spinner.message(`Warning: Could not read rule file: ${ruleSourcePath}`);
                continue;
              }

              // Parse frontmatter
              const parsed = parseFrontmatter(rawContent);

              // Build canonical RuleFile
              const ruleFile: RuleFile = {
                name: ruleName,
                content: rawContent,
                frontmatter:
                  Object.keys(parsed.data).length > 0
                    ? (parsed.data as RuleFile["frontmatter"])
                    : undefined,
              };

              // Transform rule for this adapter
              const transformed = adapter.transformRule(ruleFile);

              // Compute target path to detect shared file destinations
              const targetPath = adapter.getPath("rules", "project", ruleName);
              const absolutePath = targetPath.startsWith("/")
                ? targetPath
                : resolve(projectRoot, targetPath);

              // Accumulate content for this target path
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
                  profiles: new Set([ruleEntry.profileName]),
                });
              }
            } catch (error) {
              spinner.message(`Error placing rule ${ruleEntry.name} for ${adapter.name}: ${error}`);
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
              // Normalize: strip .md extension to prevent double-extension bug
              // (manifest may declare "code-reviewer.md", path template appends ".md" again)
              const agentName = agentEntry.name.replace(/\.md$/, "");

              // Check if this agent should be placed for this adapter
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

              // Determine source file path based on agent type
              const agentSubdir = isUniversal ? "universal" : agentEntry.agents[0];
              const agentSourcePath = resolve(
                profileDir,
                "ai",
                "agents",
                agentSubdir,
                `${agentName}.md`,
              );

              // Read agent content
              let rawContent: string;
              try {
                rawContent = await readFile(agentSourcePath, "utf-8");
              } catch {
                spinner.message(`Warning: Could not read agent file: ${agentSourcePath}`);
                continue;
              }

              // Parse frontmatter
              const parsed = parseFrontmatter(rawContent);

              // Build canonical AgentFile (frontmatter is REQUIRED)
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

              // Transform agent for this adapter
              const transformed = adapter.transformAgent(agentFile);

              // Compute target path to detect shared file destinations
              const targetPath = adapter.getPath("agents", "project", agentName);
              const absolutePath = targetPath.startsWith("/")
                ? targetPath
                : resolve(projectRoot, targetPath);

              // Accumulate content for this target path
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

      // Flush accumulated content: write combined memory+rules+agents to shared file paths
      if (!dryRun && syncAi) {
        for (const [absolutePath, entry] of contentAccumulator) {
          try {
            const combinedContent = entry.parts.join("\n\n");
            const result = await placeFile(
              combinedContent,
              entry.adapter,
              entry.type,
              "project",
              entry.name,
              placementConfig,
            );

            if (result.action !== "skipped") {
              stats.created++;
            }

            // Track tool-specific disk path for state/orphan detection
            const relPath = isAbsolute(result.path)
              ? relative(projectRoot, result.path)
              : result.path;
            actualPlacedPaths.add(relPath);

            // Track canonical key + source content for lockfile integrity (once per canonical item)
            const canonicalKey = `${entry.type}/${entry.name}`;
            for (const profileName of entry.profiles) {
              const pf = getOrCreatePlacedFiles(placedFiles, profileName);
              if (!pf[canonicalKey]) {
                pf[canonicalKey] = {
                  content: combinedContent,
                  type: entry.type as LockFileEntry["type"],
                };
              }
            }

            if (verbose) {
              const label = result.action === "skipped" ? "unchanged, skipped" : result.action;
              p.log.info(`  -> ${result.path} (${label})`);
            }
          } catch (error) {
            spinner.message(`Error placing accumulated content to ${absolutePath}: ${error}`);
            stats.errors++;
          }
        }
      }

      // Place command files
      if (!dryRun && syncAi) {
        for (const adapter of adapters) {
          if (verbose) {
            p.log.step(`[${adapter.key}] Placing commands...`);
          }
          for (const profile of allProfiles) {
            const profileDir = profileLocalPaths.get(profile.name);
            if (!profileDir) continue;

            const commandNames = profile.manifest.ai?.commands || [];
            for (const commandName of commandNames) {
              try {
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
                  // Gracefully skip missing command files
                  continue;
                }

                const result = await placeFile(
                  content,
                  adapter,
                  "commands",
                  "project",
                  commandName,
                  placementConfig,
                );

                if (result.action !== "skipped") {
                  stats.created++;
                }

                // Track tool-specific disk path for state/orphan detection
                const cmdRelPath = isAbsolute(result.path)
                  ? relative(projectRoot, result.path)
                  : result.path;
                actualPlacedPaths.add(cmdRelPath);

                // Track canonical key + source content for lockfile (once per command)
                const canonicalKey = `commands/${commandName}`;
                const pf = getOrCreatePlacedFiles(placedFiles, profile.name);
                if (!pf[canonicalKey]) {
                  pf[canonicalKey] = { content, type: "commands" };
                }

                if (verbose) {
                  const label = result.action === "skipped" ? "unchanged, skipped" : result.action;
                  p.log.info(`  -> ${result.path} (${label})`);
                }
              } catch (error) {
                spinner.message(
                  `Error placing command ${commandName} for ${adapter.name}: ${error}`,
                );
                stats.errors++;
              }
            }
          }
        }
      }

      // Place project files (files/ -> project root)
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
              // Gracefully skip missing files directories
              continue;
            }

            const targetPath = resolve(projectRoot, fileEntry.target);

            // Ensure target directory exists
            await mkdir(dirname(targetPath), { recursive: true });

            // Idempotency: skip if content is identical
            const existing = await readFile(targetPath, "utf-8").catch(() => undefined);
            if (existing !== content) {
              await writeFile(targetPath, content, "utf-8");
              stats.created++;
              if (verbose) {
                p.log.info(`  -> ${fileEntry.target} (created)`);
              }
            } else if (verbose) {
              p.log.info(`  -> ${fileEntry.target} (unchanged, skipped)`);
            }

            // Track disk path for state/orphan detection
            actualPlacedPaths.add(fileEntry.target);

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

      // Place IDE config files (ide/vscode/ -> .vscode/, ide/jetbrains/ -> .idea/)
      // Only place files for IDE platforms in the intersection (if intersection is available)
      if (!dryRun && syncIde) {
        for (const ideEntry of ideMap.values()) {
          try {
            // Filter by intersection: skip IDE platforms not in the developer's synced set
            if (syncedIdePlatforms !== null && !syncedIdePlatforms.includes(ideEntry.ideKey)) {
              if (verbose) {
                p.log.info(
                  `  -> ${ideEntry.targetDir}/${ideEntry.fileName} (skipped — IDE platform "${ideEntry.ideKey}" not in intersection)`,
                );
              }
              continue;
            }

            const profileDir = profileLocalPaths.get(ideEntry.profileName);
            if (!profileDir) continue;

            const ideSourcePath = resolve(profileDir, "ide", ideEntry.ideKey, ideEntry.fileName);

            let content: string;
            try {
              content = await readFile(ideSourcePath, "utf-8");
            } catch {
              // Gracefully skip missing IDE config files
              continue;
            }

            const targetPath = resolve(projectRoot, ideEntry.targetDir, ideEntry.fileName);

            // Ensure target directory exists
            await mkdir(dirname(targetPath), { recursive: true });

            // Idempotency: skip if content is identical
            const existing = await readFile(targetPath, "utf-8").catch(() => undefined);
            if (existing !== content) {
              await writeFile(targetPath, content, "utf-8");
              stats.created++;
              if (verbose) {
                p.log.info(`  -> ${ideEntry.targetDir}/${ideEntry.fileName} (created)`);
              }
            } else if (verbose) {
              p.log.info(`  -> ${ideEntry.targetDir}/${ideEntry.fileName} (unchanged, skipped)`);
            }

            // Track disk path for state/orphan detection
            const ideRelPath = `${ideEntry.targetDir}/${ideEntry.fileName}`;
            actualPlacedPaths.add(ideRelPath);

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
          : `Placed ${stats.created} file(s) for ${adapters.length} agent(s)`,
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
        await writeLockData({ allProfiles, sourceShas, placedFiles, projectRoot, spinner });
      }

      // Step 9b: Write local state (tool-specific disk paths, never committed)
      if (!dryRun) {
        await writeStateData({
          actualPlacedPaths,
          syncedAiTools,
          projectRoot,
          spinner,
        });
      }

      // Step 10: Remove orphaned files (comparing tool-specific disk paths)
      await cleanupOrphanedFiles({
        previousPaths,
        currentPaths: actualPlacedPaths,
        projectRoot,
        dryRun,
        autoYes,
        spinner,
      });

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
          // Show filtered count when intersection is active
          const filteredIdeCount =
            syncedIdePlatforms !== null
              ? [...ideMap.values()].filter((e) => syncedIdePlatforms.includes(e.ideKey)).length
              : mergedIdeCount;
          parts.push(`  • ${filteredIdeCount} IDE configs`);
        }
        const categoryLabel = category ? ` (category: ${category})` : "";
        p.outro(
          `[Dry Run${categoryLabel}] Would sync:\n${parts.join("\n")}\n\nFor ${adapters.length} agent(s): ${syncedAiTools.join(", ")}`,
        );
      } else {
        const categoryLabel = category ? ` (category: ${category})` : "";
        p.outro(`✅ Sync complete${categoryLabel}! Configurations updated.`);
      }

      process.exit(stats.errors > 0 ? 1 : 0);
    } catch (error) {
      p.cancel(`Sync failed: ${error}`);
      process.exit(1);
    }
  },
});
