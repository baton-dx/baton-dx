import { access, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProjectManifest } from "@baton-dx/core";
import {
  FileNotFoundError,
  getAllAdapters,
  getDefaultGlobalSource,
  getGlobalAiTools,
  getGlobalIdePlatforms,
  getGlobalSources,
  getRegisteredIdePlatforms,
  loadProjectManifest,
  readLock,
  readProjectPreferences,
  removePlacedFiles,
  writeProjectPreferences,
} from "@baton-dx/core";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { stringify } from "yaml";
import { buildIntersection } from "../utils/build-intersection.js";
import { displayIntersection, formatIntersectionSummary } from "../utils/intersection-display.js";
import { selectProfileFromSource } from "../utils/profile-selection.js";
import { runBatonSync } from "../utils/run-baton-sync.js";

async function loadProjectManifestSafe(cwd: string): Promise<ProjectManifest | null> {
  try {
    return await loadProjectManifest(join(cwd, "baton.yaml"));
  } catch {
    return null;
  }
}

async function hasLockfile(cwd: string): Promise<boolean> {
  try {
    await access(join(cwd, "baton.lock"));
    return true;
  } catch {
    return false;
  }
}

async function showOverview(cwd: string): Promise<void> {
  const [manifest, sources, synced] = await Promise.all([
    loadProjectManifestSafe(cwd),
    getGlobalSources(),
    hasLockfile(cwd),
  ]);

  if (!manifest) {
    p.log.warn("Could not load baton.yaml");
    return;
  }

  // --- Installed Profiles ---
  p.log.step("Installed Profiles");
  if (manifest.profiles.length === 0) {
    p.log.info("  No profiles installed.");
  } else {
    for (const profile of manifest.profiles) {
      const version = profile.version ? ` (${profile.version})` : "";
      const matchingSource = sources.find(
        (s) => profile.source.includes(s.url) || profile.source.includes(s.name),
      );
      const sourceName = matchingSource ? ` [${matchingSource.name}]` : "";
      p.log.info(`  ${profile.source}${version}${sourceName}`);
    }
  }

  // --- Intersection per Profile ---
  if (manifest.profiles.length > 0) {
    const aiTools = await getGlobalAiTools();
    const idePlatforms = await getGlobalIdePlatforms();

    if (aiTools.length > 0 || idePlatforms.length > 0) {
      const developerTools = { aiTools, idePlatforms };
      console.log("");
      p.log.step("Tool Intersection");

      for (const profile of manifest.profiles) {
        try {
          const intersection = await buildIntersection(profile.source, developerTools, cwd);
          if (intersection) {
            const summary = formatIntersectionSummary(intersection);
            p.log.info(`  ${profile.source}: ${summary}`);
            displayIntersection(intersection);
          }
        } catch {
          // Best-effort — skip if intersection cannot be computed
        }
      }
    }
  }

  // --- Sync Status ---
  console.log("");
  p.log.step("Sync Status");
  if (synced) {
    p.log.info("  Synced (baton.lock exists)");
  } else {
    p.log.info("  Not synced — run 'baton sync' to sync profiles");
  }

  // --- Global Sources ---
  console.log("");
  p.log.step("Global Sources");
  if (sources.length === 0) {
    p.log.info("  No sources configured. Run: baton source connect <url>");
  } else {
    for (const source of sources) {
      const defaultBadge = source.default ? " (default)" : "";
      p.log.info(`  ${source.name}${defaultBadge}: ${source.url}`);
    }
  }
}

async function handleAddProfile(cwd: string): Promise<void> {
  const manifestPath = join(cwd, "baton.yaml");
  const manifest = await loadProjectManifestSafe(cwd);
  if (!manifest) {
    p.log.error("Could not load baton.yaml");
    return;
  }

  // 1. Get global sources
  const globalSources = await getGlobalSources();
  if (globalSources.length === 0) {
    p.log.warn("No global sources configured. Run: baton source connect <url>");
    return;
  }

  // 2. Select a source
  let sourceString: string;
  if (globalSources.length === 1) {
    sourceString = globalSources[0].url;
    p.log.info(`Using source: ${globalSources[0].name} (${sourceString})`);
  } else {
    const defaultSource = await getDefaultGlobalSource();
    const selectedUrl = await p.select({
      message: "Select a source repository:",
      options: globalSources.map((s) => ({
        value: s.url,
        label: s.default ? `${s.name} [default]` : s.name,
        hint: s.description || s.url,
      })),
      initialValue: defaultSource?.url,
    });

    if (p.isCancel(selectedUrl)) {
      p.log.warn("Cancelled.");
      return;
    }
    sourceString = selectedUrl as string;
  }

  // 3. Select a profile from the source
  const selectedSource = await selectProfileFromSource(sourceString);

  // 4. Check for duplicates
  const alreadyExists = manifest.profiles.some((pr) => pr.source === selectedSource);
  if (alreadyExists) {
    p.log.warn(`Profile "${selectedSource}" is already installed.`);
    return;
  }

  // 5. Add to manifest and write
  manifest.profiles.push({ source: selectedSource });
  const updatedYaml = stringify(manifest);
  await writeFile(manifestPath, updatedYaml, "utf-8");
  p.log.success(`Added profile: ${selectedSource}`);

  // 6. Offer to sync
  const shouldSync = await p.confirm({
    message: "Sync profiles now?",
    initialValue: true,
  });

  if (p.isCancel(shouldSync) || !shouldSync) {
    p.log.info("Run 'baton sync' later to apply the new profile.");
    return;
  }

  await runBatonSync(cwd);
}

async function handleRemoveProfile(cwd: string): Promise<void> {
  const manifestPath = join(cwd, "baton.yaml");
  const manifest = await loadProjectManifestSafe(cwd);
  if (!manifest) {
    p.log.error("Could not load baton.yaml");
    return;
  }

  if (manifest.profiles.length === 0) {
    p.log.warn("No profiles installed.");
    return;
  }

  // 1. Select profile to remove
  const selected = await p.select({
    message: "Which profile do you want to remove?",
    options: manifest.profiles.map((pr) => ({
      value: pr.source,
      label: pr.source,
      hint: pr.version ? `v${pr.version}` : undefined,
    })),
  });

  if (p.isCancel(selected)) {
    p.log.warn("Cancelled.");
    return;
  }

  const profileSource = selected as string;

  // 2. Confirm removal
  const confirmed = await p.confirm({
    message: `Remove profile "${profileSource}"?`,
    initialValue: false,
  });

  if (p.isCancel(confirmed) || !confirmed) {
    p.log.warn("Cancelled.");
    return;
  }

  // 3. Remove from manifest and write
  const profileIndex = manifest.profiles.findIndex((pr) => pr.source === profileSource);
  manifest.profiles.splice(profileIndex, 1);

  const updatedYaml = stringify(manifest);
  await writeFile(manifestPath, updatedYaml, "utf-8");
  p.log.success(`Removed profile: ${profileSource}`);
  p.log.info("Run 'baton sync' to clean up synced files.");
}

async function handleRemoveBaton(cwd: string): Promise<boolean> {
  // 1. Warning
  p.log.warn("This will remove Baton from your project:");
  p.log.info("  - baton.yaml (project manifest)");
  p.log.info("  - baton.lock (lockfile)");

  // 2. Confirm
  const confirmed = await p.confirm({
    message: "Are you sure you want to remove Baton from this project?",
    initialValue: false,
  });

  if (p.isCancel(confirmed) || !confirmed) {
    p.log.warn("Cancelled.");
    return false;
  }

  // 3. Offer to clean up placed files from lockfile
  const lockPath = join(cwd, "baton.lock");
  await cleanupPlacedFilesFromLock(lockPath, cwd);

  // 4. Delete baton.yaml
  const manifestPath = join(cwd, "baton.yaml");
  await rm(manifestPath, { force: true });

  // 5. Delete baton.lock
  await rm(lockPath, { force: true });

  p.log.success("Baton has been removed from this project.");
  return true;
}

async function cleanupPlacedFilesFromLock(lockPath: string, projectRoot: string): Promise<void> {
  let placedPaths: string[];
  try {
    const lockfile = await readLock(lockPath);
    placedPaths = Object.values(lockfile.packages).flatMap((pkg) => Object.keys(pkg.integrity));
  } catch (error) {
    if (error instanceof FileNotFoundError) return;
    // Invalid lockfile — skip cleanup silently
    return;
  }

  if (placedPaths.length === 0) return;

  p.log.info(`Found ${placedPaths.length} placed file(s):`);
  for (const filePath of placedPaths) {
    p.log.info(`  ${filePath}`);
  }

  const shouldClean = await p.confirm({
    message: `Also remove ${placedPaths.length} placed file(s)?`,
    initialValue: false,
  });

  if (p.isCancel(shouldClean) || !shouldClean) return;

  const removedCount = await removePlacedFiles(placedPaths, projectRoot);
  p.log.success(`Removed ${removedCount} placed file(s).`);
}

function formatIdeName(ideKey: string): string {
  const names: Record<string, string> = {
    vscode: "VS Code",
    jetbrains: "JetBrains",
    cursor: "Cursor",
    windsurf: "Windsurf",
    antigravity: "Antigravity",
    zed: "Zed",
  };
  return names[ideKey] ?? ideKey;
}

async function handleConfigureAiTools(cwd: string): Promise<void> {
  const existing = await readProjectPreferences(cwd);
  const globalTools = await getGlobalAiTools();

  if (globalTools.length > 0) {
    p.log.info(`Global AI tools: ${globalTools.join(", ")}`);
  }

  // Ask useGlobal first
  const mode = await p.select({
    message: "How should this project resolve AI tools?",
    options: [
      {
        value: "global",
        label: "Use global config",
        hint: "always follows your global AI tools setting",
      },
      {
        value: "project",
        label: "Customize for this project",
        hint: "choose specific tools for this project",
      },
    ],
    initialValue: existing?.ai.useGlobal === false ? "project" : "global",
  });

  if (p.isCancel(mode)) {
    p.log.warn("Cancelled.");
    return;
  }

  if (mode === "global") {
    await writeProjectPreferences(cwd, {
      version: "1.0",
      ai: { useGlobal: true, tools: [] },
      ide: existing?.ide ?? { useGlobal: true, platforms: [] },
    });
    p.log.success("Project configured to use global AI tools.");
    return;
  }

  // Customize: show multiselect
  const allAdapters = getAllAdapters();
  const currentProjectTools = existing?.ai.useGlobal === false ? existing.ai.tools : globalTools;

  const options = allAdapters.map((adapter) => ({
    value: adapter.key,
    label: globalTools.includes(adapter.key) ? `${adapter.name} (in global config)` : adapter.name,
  }));

  const selected = await p.multiselect({
    message: "Select AI tools for this project:",
    options,
    initialValues: currentProjectTools,
  });

  if (p.isCancel(selected)) {
    p.log.warn("Cancelled.");
    return;
  }

  const selectedKeys = selected as string[];

  await writeProjectPreferences(cwd, {
    version: "1.0",
    ai: { useGlobal: false, tools: selectedKeys },
    ide: existing?.ide ?? { useGlobal: true, platforms: [] },
  });

  p.log.success(`Project configured with ${selectedKeys.length} AI tool(s).`);
}

async function handleConfigureIdes(cwd: string): Promise<void> {
  const existing = await readProjectPreferences(cwd);
  const globalPlatforms = await getGlobalIdePlatforms();

  if (globalPlatforms.length > 0) {
    p.log.info(`Global IDE platforms: ${globalPlatforms.join(", ")}`);
  }

  // Ask useGlobal first
  const mode = await p.select({
    message: "How should this project resolve IDE platforms?",
    options: [
      {
        value: "global",
        label: "Use global config",
        hint: "always follows your global IDE platforms setting",
      },
      {
        value: "project",
        label: "Customize for this project",
        hint: "choose specific IDEs for this project",
      },
    ],
    initialValue: existing?.ide.useGlobal === false ? "project" : "global",
  });

  if (p.isCancel(mode)) {
    p.log.warn("Cancelled.");
    return;
  }

  if (mode === "global") {
    await writeProjectPreferences(cwd, {
      version: "1.0",
      ai: existing?.ai ?? { useGlobal: true, tools: [] },
      ide: { useGlobal: true, platforms: [] },
    });
    p.log.success("Project configured to use global IDE platforms.");
    return;
  }

  // Customize: show multiselect
  const allIdeKeys = getRegisteredIdePlatforms();
  const currentProjectPlatforms =
    existing?.ide.useGlobal === false ? existing.ide.platforms : globalPlatforms;

  const options = allIdeKeys.map((ideKey) => ({
    value: ideKey,
    label: globalPlatforms.includes(ideKey)
      ? `${formatIdeName(ideKey)} (in global config)`
      : formatIdeName(ideKey),
  }));

  const selected = await p.multiselect({
    message: "Select IDE platforms for this project:",
    options,
    initialValues: currentProjectPlatforms,
  });

  if (p.isCancel(selected)) {
    p.log.warn("Cancelled.");
    return;
  }

  const selectedKeys = selected as string[];

  await writeProjectPreferences(cwd, {
    version: "1.0",
    ai: existing?.ai ?? { useGlobal: true, tools: [] },
    ide: { useGlobal: false, platforms: selectedKeys },
  });

  p.log.success(`Project configured with ${selectedKeys.length} IDE platform(s).`);
}

async function handleConfigureGitignore(cwd: string): Promise<void> {
  const manifestPath = join(cwd, "baton.yaml");
  const manifest = await loadProjectManifestSafe(cwd);
  if (!manifest) {
    p.log.error("Could not load baton.yaml");
    return;
  }

  const currentSetting = manifest.gitignore !== false;
  p.log.info(
    currentSetting
      ? "Currently: synced files ARE gitignored"
      : "Currently: synced files are NOT gitignored (committed to repo)",
  );

  const newSetting = await p.confirm({
    message: "Add synced AI tool and IDE config files to .gitignore?",
    initialValue: currentSetting,
  });

  if (p.isCancel(newSetting)) {
    p.log.warn("Cancelled.");
    return;
  }

  if (newSetting === currentSetting) {
    p.log.info("No change.");
    return;
  }

  manifest.gitignore = newSetting;
  const updatedYaml = stringify(manifest);
  await writeFile(manifestPath, updatedYaml, "utf-8");
  p.log.success(
    newSetting
      ? "Enabled .gitignore management. Run 'baton sync' to update."
      : "Disabled .gitignore management. Run 'baton sync' to clean up.",
  );
}

export const manageCommand = defineCommand({
  meta: {
    name: "manage",
    description: "Interactive project management wizard for Baton",
  },
  async run() {
    const cwd = process.cwd();

    // Guard: must be in an initialized project
    const manifest = await loadProjectManifestSafe(cwd);
    if (!manifest) {
      p.intro("Baton Manage");
      p.cancel("baton.yaml not found. Run 'baton init' first.");
      process.exit(1);
    }

    p.intro("Baton Manage");

    // Loop-based wizard
    while (true) {
      const action = await p.select({
        message: "What would you like to do?",
        options: [
          { value: "overview", label: "Overview", hint: "Show project configuration" },
          { value: "add-profile", label: "Add profile", hint: "Add a profile from a source" },
          { value: "remove-profile", label: "Remove profile", hint: "Remove an installed profile" },
          {
            value: "configure-ai",
            label: "Configure AI tools for this project",
            hint: "Choose which AI tools to sync",
          },
          {
            value: "configure-ides",
            label: "Configure IDEs for this project",
            hint: "Choose which IDEs to sync",
          },
          {
            value: "configure-gitignore",
            label: "Configure .gitignore",
            hint: "Choose whether synced files are gitignored",
          },
          { value: "remove-baton", label: "Remove Baton", hint: "Remove Baton from this project" },
          { value: "quit", label: "Quit" },
        ],
      });

      if (p.isCancel(action) || action === "quit") {
        p.outro("Goodbye!");
        return;
      }

      if (action === "overview") {
        console.log("");
        await showOverview(cwd);
        console.log("");
      } else if (action === "add-profile") {
        console.log("");
        await handleAddProfile(cwd);
        console.log("");
      } else if (action === "remove-profile") {
        console.log("");
        await handleRemoveProfile(cwd);
        console.log("");
      } else if (action === "configure-ai") {
        console.log("");
        await handleConfigureAiTools(cwd);
        console.log("");
      } else if (action === "configure-ides") {
        console.log("");
        await handleConfigureIdes(cwd);
        console.log("");
      } else if (action === "configure-gitignore") {
        console.log("");
        await handleConfigureGitignore(cwd);
        console.log("");
      } else if (action === "remove-baton") {
        console.log("");
        const removed = await handleRemoveBaton(cwd);
        if (removed) {
          p.outro("Goodbye!");
          return;
        }
        console.log("");
      }
    }
  },
});
