import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ProjectManifest, SourceManifest } from "@baton-dx/core";
import {
  type GitignoreSection,
  clearAIToolCache,
  clearIdeCache,
  cloneGitSource,
  collectAiToolPatterns,
  collectIdePatterns,
  computeIntersection,
  detectInstalledAITools,
  detectInstalledIdes,
  findSourceManifest,
  getDefaultGlobalSource,
  getGlobalAiTools,
  getGlobalIdePlatforms,
  getGlobalSources,
  loadProfileManifest,
  parseSource,
  resolveProfileSupport,
  setGlobalAiTools,
  setGlobalIdePlatforms,
  updateGitignoreWithSections,
} from "@baton-dx/core";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { stringify } from "yaml";
import { findSourceRoot } from "../utils/context-detection.js";
import { promptFirstRunPreferences } from "../utils/first-run-preferences.js";
import { displayIntersection } from "../utils/intersection-display.js";
import { selectMultipleProfilesFromSource } from "../utils/profile-selection.js";
import { runBatonSync } from "../utils/run-baton-sync.js";

export const initCommand = defineCommand({
  meta: {
    name: "init",
    description: "Initialize Baton in your project with an interactive setup wizard",
  },
  args: {
    yes: {
      type: "boolean",
      alias: "y",
      description: "Skip all prompts and use defaults",
    },
    force: {
      type: "boolean",
      description: "Overwrite existing baton.yaml",
    },
    profile: {
      type: "string",
      description: "Profile source to install (skips profile selection)",
    },
  },
  async run({ args }) {
    const isInteractive = !args.yes;
    const cwd = process.cwd();

    p.intro("🎯 Welcome to Baton");

    // 1. Check if baton.yaml already exists
    try {
      await readFile(join(cwd, "baton.yaml"));
      if (!args.force) {
        p.cancel("baton.yaml already exists in this directory.");
        p.note(
          "Use `baton manage` to modify your project configuration\nor `baton sync` to sync your profiles.\n\nTo reinitialize, use `baton init --force`.",
          "Already initialized",
        );
        process.exit(1);
      }
      p.log.warn("Overwriting existing baton.yaml (--force)");
    } catch (_error) {
      // File doesn't exist, continue
    }

    // 2. Auto-scan AI tools and IDEs if not yet configured
    const spinner = p.spinner();
    await autoScanAiTools(spinner, isInteractive);
    await autoScanIdePlatforms(spinner, isInteractive);

    // 3. Determine source URL(s) with global sources integration
    let profileSources: string[];

    if (args.profile) {
      // Explicit --profile flag: use it (may trigger multi-select)
      profileSources = await selectMultipleProfilesFromSource(args.profile, {
        nonInteractive: !isInteractive,
      });
    } else {
      // No --profile flag: check global sources
      const globalSources = await getGlobalSources();

      if (globalSources.length === 0) {
        // No global sources: abort with guidance
        p.cancel("No sources configured.");
        p.note(
          "Connect a source repository first:\n\n  baton source connect <url>\n\nExample:\n  baton source connect github:my-org/dx-config",
          "No sources found",
        );
        process.exit(1);
      } else if (globalSources.length === 1 && globalSources[0].default) {
        // Single default source: auto-use it
        const defaultSource = globalSources[0];
        p.note(`Using default source: ${defaultSource.name}\n${defaultSource.url}`, "Source");
        profileSources = await selectMultipleProfilesFromSource(defaultSource.url, {
          nonInteractive: !isInteractive,
        });
      } else {
        // Multiple sources: show source selection
        if (!isInteractive) {
          // Non-interactive: use default source if available, otherwise first source
          const defaultSource = await getDefaultGlobalSource();
          const sourceUrl = defaultSource?.url || globalSources[0].url;
          profileSources = await selectMultipleProfilesFromSource(sourceUrl, {
            nonInteractive: true,
          });
        } else {
          const defaultSource = await getDefaultGlobalSource();

          const selectedUrl = (await p.select({
            message: "Select a source repository:",
            options: globalSources.map((s) => ({
              value: s.url,
              label: s.default ? `${s.name} [default]` : s.name,
              hint: s.description || s.url,
            })),
            initialValue: defaultSource?.url,
          })) as string;

          if (p.isCancel(selectedUrl)) {
            p.cancel("Setup cancelled.");
            process.exit(0);
          }

          profileSources = await selectMultipleProfilesFromSource(selectedUrl);
        }
      }
    }

    // 4. Show intersection between developer tools and profile support
    await showProfileIntersections(profileSources);

    // 5. Ask which categories of synced files should be gitignored
    // Default: ai-tools and ides are gitignored; custom files are committed
    type GitignoreCategories = { "ai-tools": boolean; ides: boolean; files: boolean };
    let gitignoreCategories: GitignoreCategories = { "ai-tools": true, ides: true, files: false };

    if (isInteractive) {
      const selectedCategories = await p.multiselect({
        message: "Which synced config files should be added to .gitignore?",
        options: [
          {
            value: "ai-tools",
            label: "AI tool configs",
            hint: ".claude/, .cursor/, .github/copilot-instructions.md, ...",
          },
          {
            value: "ides",
            label: "IDE configs",
            hint: ".vscode/, .idea/, ...",
          },
          {
            value: "files",
            label: "Custom files",
            hint: "biome.json, tsconfig.json, and other files placed by profiles",
          },
        ],
        initialValues: ["ai-tools", "ides"],
      });

      if (p.isCancel(selectedCategories)) {
        p.cancel("Setup cancelled.");
        process.exit(0);
      }

      gitignoreCategories = {
        "ai-tools": selectedCategories.includes("ai-tools"),
        ides: selectedCategories.includes("ides"),
        files: selectedCategories.includes("files"),
      };
    }

    // 6. Generate baton.yaml with multiple profiles and gitignore setting
    const manifest: ProjectManifest = {
      profiles: profileSources.map((source) => ({ source })),
      gitignore: gitignoreCategories,
    };

    const yamlContent = stringify(manifest);

    spinner.start("Creating baton.yaml...");
    await writeFile(join(cwd, "baton.yaml"), yamlContent, "utf-8");
    spinner.stop("✅ Created baton.yaml");

    // 7. Update .gitignore
    spinner.start("Updating .gitignore...");
    const gitignorePath = join(cwd, ".gitignore");
    let gitignoreContent = "";

    try {
      gitignoreContent = await readFile(gitignorePath, "utf-8");
    } catch (_error) {
      // .gitignore doesn't exist, create new
    }

    // Always ensure .baton/ is gitignored
    if (!gitignoreContent.includes(".baton/")) {
      const newContent = gitignoreContent
        ? `${gitignoreContent}\n\n# Baton local\n.baton/\n`
        : "# Baton local\n.baton/\n";
      await writeFile(gitignorePath, newContent, "utf-8");
    }

    // Write gitignore patterns for selected categories (files require a sync for actual targets)
    const sections: GitignoreSection[] = [];
    if (gitignoreCategories["ai-tools"])
      sections.push({ label: "ai-tools", patterns: collectAiToolPatterns() });
    if (gitignoreCategories.ides) sections.push({ label: "ides", patterns: collectIdePatterns() });

    if (sections.length > 0) {
      await updateGitignoreWithSections(cwd, sections);
      spinner.stop("✅ Updated .gitignore with managed file patterns");
    } else {
      spinner.stop("✅ Added .baton/ to .gitignore");
    }

    // 8. Create .baton directory
    spinner.start("Creating .baton directory...");
    try {
      await mkdir(join(cwd, ".baton"), { recursive: true });
      spinner.stop("✅ Created .baton directory");
    } catch (_error) {
      spinner.stop("✅ .baton directory already exists");
    }

    // 9. First-run preferences prompt
    await promptFirstRunPreferences(cwd, !isInteractive);

    // 10. Offer to sync profiles
    if (profileSources.length > 0) {
      const shouldSync = isInteractive
        ? await p.confirm({
            message: "Fetch profiles and sync now?",
            initialValue: true,
          })
        : true; // --yes mode: auto-sync

      if (!p.isCancel(shouldSync) && shouldSync) {
        await runBatonSync(cwd);
      } else {
        p.log.info("Run 'baton sync' later to fetch and apply your profiles.");
      }
    }

    // 11. Summary
    p.outro("Baton initialized successfully!");
  },
});

/**
 * Auto-scan AI tools if none are configured in global config.
 * In interactive mode: shows results and asks for confirmation.
 * In non-interactive mode (--yes): auto-saves detected tools.
 */
async function autoScanAiTools(
  spinner: ReturnType<typeof p.spinner>,
  isInteractive: boolean,
): Promise<void> {
  const existingTools = await getGlobalAiTools();
  if (existingTools.length > 0) {
    p.log.info(`AI tools already configured: ${existingTools.join(", ")}`);
    return;
  }

  spinner.start("Scanning for installed AI tools...");
  clearAIToolCache();
  const detectedTools = await detectInstalledAITools();
  spinner.stop(
    detectedTools.length > 0
      ? `Found ${detectedTools.length} AI tool${detectedTools.length !== 1 ? "s" : ""}: ${detectedTools.join(", ")}`
      : "No AI tools detected.",
  );

  if (detectedTools.length === 0) {
    p.log.warn("No AI tools detected. You can run 'baton ai-tools scan' later.");
    return;
  }

  if (isInteractive) {
    const shouldSave = await p.confirm({
      message: "Save detected AI tools to global config?",
      initialValue: true,
    });

    if (p.isCancel(shouldSave) || !shouldSave) {
      p.log.info("Skipped saving AI tools. Run 'baton ai-tools scan' later.");
      return;
    }
  }

  await setGlobalAiTools(detectedTools);
  p.log.success("AI tools saved to global config.");
}

/**
 * Auto-scan IDE platforms if none are configured in global config.
 * In interactive mode: shows results and asks for confirmation.
 * In non-interactive mode (--yes): auto-saves detected platforms.
 */
async function autoScanIdePlatforms(
  spinner: ReturnType<typeof p.spinner>,
  isInteractive: boolean,
): Promise<void> {
  const existingPlatforms = await getGlobalIdePlatforms();
  if (existingPlatforms.length > 0) {
    p.log.info(`IDE platforms already configured: ${existingPlatforms.join(", ")}`);
    return;
  }

  spinner.start("Scanning for installed IDE platforms...");
  clearIdeCache();
  const detectedIdes = await detectInstalledIdes();
  spinner.stop(
    detectedIdes.length > 0
      ? `Found ${detectedIdes.length} IDE platform${detectedIdes.length !== 1 ? "s" : ""}: ${detectedIdes.join(", ")}`
      : "No IDE platforms detected.",
  );

  if (detectedIdes.length === 0) {
    p.log.warn("No IDE platforms detected. You can run 'baton ides scan' later.");
    return;
  }

  if (isInteractive) {
    const shouldSave = await p.confirm({
      message: "Save detected IDE platforms to global config?",
      initialValue: true,
    });

    if (p.isCancel(shouldSave) || !shouldSave) {
      p.log.info("Skipped saving IDE platforms. Run 'baton ides scan' later.");
      return;
    }
  }

  await setGlobalIdePlatforms(detectedIdes);
  p.log.success("IDE platforms saved to global config.");
}

/**
 * Load source/profile manifests for each selected profile and display
 * the intersection between developer tools and profile support.
 *
 * Gracefully handles errors (e.g., missing source manifest) — the intersection
 * display is informational and should not block init.
 */
async function showProfileIntersections(profileSources: string[]): Promise<void> {
  const aiTools = await getGlobalAiTools();
  const idePlatforms = await getGlobalIdePlatforms();

  // No developer tools configured — nothing to intersect
  if (aiTools.length === 0 && idePlatforms.length === 0) {
    return;
  }

  const developerTools = { aiTools, idePlatforms };

  for (const sourceString of profileSources) {
    try {
      const parsed = parseSource(sourceString);

      let repoRoot: string;
      let profileDir: string;

      if (parsed.provider === "github" || parsed.provider === "gitlab") {
        // Clone repo (cache hit) — without subpath to get the repo root
        const repoClone = await cloneGitSource({
          url: parsed.url,
          ref: parsed.ref,
          useCache: true,
          maxCacheAgeMs: 0,
        });
        repoRoot = repoClone.localPath;
        profileDir = parsed.subpath ? resolve(repoRoot, parsed.subpath) : repoRoot;
      } else if (parsed.provider === "local" || parsed.provider === "file") {
        const absolutePath = parsed.path.startsWith("/")
          ? parsed.path
          : resolve(process.cwd(), parsed.path);
        profileDir = absolutePath;
        // Walk up from profile dir to find source root (containing baton.source.yaml)
        repoRoot = (await findSourceRoot(absolutePath, { fallbackToStart: true })) as string;
      } else {
        // git/npm providers — skip intersection display
        continue;
      }

      // Load source manifest (optional — source may not have one)
      let sourceManifest: SourceManifest;
      try {
        sourceManifest = await findSourceManifest(repoRoot);
      } catch {
        // No source manifest — use empty defaults
        sourceManifest = { name: "unknown", version: "0.0.0" } as SourceManifest;
      }

      // Load profile manifest
      const profileManifestPath = resolve(profileDir, "baton.profile.yaml");
      const profileManifest = await loadProfileManifest(profileManifestPath).catch(() => null);
      if (!profileManifest) continue;

      // Compute intersection
      const profileSupport = resolveProfileSupport(profileManifest, sourceManifest);
      const intersection = computeIntersection(developerTools, profileSupport);

      // Only display if there's meaningful data
      const hasData =
        intersection.aiTools.synced.length > 0 ||
        intersection.aiTools.unavailable.length > 0 ||
        intersection.idePlatforms.synced.length > 0 ||
        intersection.idePlatforms.unavailable.length > 0;

      if (hasData) {
        p.log.step(`Intersection for ${profileManifest.name}`);
        displayIntersection(intersection);
      }
    } catch {
      // Intersection display is best-effort — don't block init
    }
  }
}
