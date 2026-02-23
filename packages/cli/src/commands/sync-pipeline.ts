import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  type LockFileEntry,
  type PlacementState,
  type ProjectManifest,
  collectComprehensivePatterns,
  ensureBatonDirGitignored,
  generateLock,
  readState,
  removeGitignoreManagedSection,
  removePlacedFiles,
  updateGitignore,
  writeLock,
  writeState,
} from "@baton-dx/core";
import * as p from "@clack/prompts";

export type SyncCategory = "ai" | "files" | "ide";
export const validCategories: SyncCategory[] = ["ai", "files", "ide"];

export interface SyncStats {
  created: number;
  errors: number;
}

/** Get or initialize placed files for a profile, avoiding unsafe `as` casts on Map.get(). */
export function getOrCreatePlacedFiles(
  map: Map<string, Record<string, LockFileEntry>>,
  profileName: string,
): Record<string, LockFileEntry> {
  let files = map.get(profileName);
  if (!files) {
    files = {};
    map.set(profileName, files);
  }
  return files;
}

/**
 * Recursively copy all files from sourceDir to targetDir.
 * Returns the number of files written (skips identical content).
 */
export async function copyDirectoryRecursive(
  sourceDir: string,
  targetDir: string,
): Promise<number> {
  await mkdir(targetDir, { recursive: true });
  const entries = await readdir(sourceDir, { withFileTypes: true });
  let placed = 0;

  for (const entry of entries) {
    const sourcePath = resolve(sourceDir, entry.name);
    const targetPath = resolve(targetDir, entry.name);

    if (entry.isDirectory()) {
      placed += await copyDirectoryRecursive(sourcePath, targetPath);
    } else {
      const content = await readFile(sourcePath, "utf-8");
      // Idempotency: skip if content is identical
      const existing = await readFile(targetPath, "utf-8").catch(() => undefined);
      if (existing !== content) {
        await writeFile(targetPath, content, "utf-8");
        placed++;
      }
    }
  }

  return placed;
}

/**
 * Handle .gitignore update based on the project manifest's gitignore setting.
 *
 * When gitignore is enabled (default): writes comprehensive patterns for ALL
 * known AI tools and IDE platforms to ensure stable, dev-independent content.
 * When disabled: removes any existing managed section.
 * Always ensures .baton/ is gitignored regardless of setting.
 */
export async function handleGitignoreUpdate(params: {
  projectManifest: ProjectManifest;
  projectRoot: string;
  spinner: ReturnType<typeof p.spinner>;
}): Promise<void> {
  const { projectManifest, projectRoot, spinner } = params;
  const gitignoreEnabled = projectManifest.gitignore !== false;

  // Always ensure .baton/ is gitignored
  await ensureBatonDirGitignored(projectRoot);

  if (gitignoreEnabled) {
    spinner.start("Updating .gitignore...");
    const patterns = collectComprehensivePatterns();
    const updated = await updateGitignore(projectRoot, patterns);
    spinner.stop(
      updated ? "Updated .gitignore with managed patterns" : ".gitignore already up to date",
    );
  } else {
    spinner.start("Checking .gitignore...");
    const removed = await removeGitignoreManagedSection(projectRoot);
    spinner.stop(removed ? "Removed managed section from .gitignore" : ".gitignore unchanged");
  }
}

/**
 * Generate and write the baton.lock lockfile from placed files and profile metadata.
 */
export async function writeLockData(params: {
  allProfiles: Array<{ name: string; source: string; manifest: { version: string } }>;
  sourceShas: Map<string, string>;
  placedFiles: Map<string, Record<string, LockFileEntry>>;
  projectRoot: string;
  spinner: ReturnType<typeof p.spinner>;
}): Promise<void> {
  const { allProfiles, sourceShas, placedFiles, projectRoot, spinner } = params;

  spinner.start("Updating lockfile...");

  const lockPackages: Record<
    string,
    {
      source: string;
      resolved: string;
      version: string;
      sha: string;
      files: Record<string, string | LockFileEntry>;
    }
  > = {};

  for (const profile of allProfiles) {
    lockPackages[profile.name] = {
      source: profile.source,
      resolved: profile.source,
      version: profile.manifest.version,
      sha: sourceShas.get(profile.source) || "unknown",
      files: placedFiles.get(profile.name) || {},
    };
  }

  const lockData = generateLock(lockPackages);
  await writeLock(lockData, resolve(projectRoot, "baton.lock"));

  spinner.stop("Lockfile updated");
}

/**
 * Write local placement state to `.baton/state.yaml`.
 * Tracks tool-specific file paths placed on disk for orphan detection.
 */
export async function writeStateData(params: {
  actualPlacedPaths: Set<string>;
  syncedAiTools: string[];
  projectRoot: string;
  spinner: ReturnType<typeof p.spinner>;
}): Promise<void> {
  const { actualPlacedPaths, syncedAiTools, projectRoot, spinner } = params;

  spinner.start("Writing local state...");

  const state: PlacementState = {
    synced_at: new Date().toISOString(),
    tools: syncedAiTools,
    placed_files: [...actualPlacedPaths].sort(),
  };

  await writeState(projectRoot, state);
  spinner.stop("Local state updated");
}

/**
 * Load previous tool-specific paths for orphan detection.
 *
 * Reads from `.baton/state.yaml` (preferred). Falls back to extracting paths
 * from an old-format `baton.lock` (legacy tool-specific keys) for migration.
 */
export async function loadPreviousPlacedPaths(projectRoot: string): Promise<Set<string>> {
  // Preferred: read from local state
  const state = await readState(projectRoot);
  if (state) {
    return new Set(state.placed_files);
  }

  // Legacy fallback: extract tool-specific paths from old baton.lock
  // (These are paths like `.claude/skills/foo` which were used as lockfile keys before)
  try {
    const { readLock } = await import("@baton-dx/core");
    const lockfilePath = resolve(projectRoot, "baton.lock");
    const previousLock = await readLock(lockfilePath);
    const paths = new Set<string>();
    for (const pkg of Object.values(previousLock.packages)) {
      for (const filePath of Object.keys(pkg.integrity)) {
        // Only include paths that look tool-specific (contain a dot-prefixed directory)
        // Canonical paths like `skills/foo` are NOT tool-specific disk paths
        if (filePath.startsWith(".") || filePath.includes("/")) {
          paths.add(filePath);
        }
      }
    }
    return paths;
  } catch {
    return new Set();
  }
}

/**
 * Detect and remove files that were previously placed but are no longer
 * part of the current sync. Compares tool-specific paths from state.yaml
 * against currently placed paths. Cleans up empty parent directories.
 */
export async function cleanupOrphanedFiles(params: {
  previousPaths: Set<string>;
  currentPaths: Set<string>;
  projectRoot: string;
  dryRun: boolean;
  autoYes: boolean;
  spinner: ReturnType<typeof p.spinner>;
}): Promise<void> {
  const { previousPaths, currentPaths, projectRoot, dryRun, autoYes, spinner } = params;

  if (previousPaths.size === 0) return;

  // Find orphaned paths (in previous state but not in current sync)
  const orphanedPaths = [...previousPaths].filter((prev) => !currentPaths.has(prev));
  if (orphanedPaths.length === 0) return;

  if (dryRun) {
    p.log.warn(`Would remove ${orphanedPaths.length} orphaned file(s):`);
    for (const orphanedPath of orphanedPaths) {
      p.log.info(`  Removed: ${orphanedPath}`);
    }
    return;
  }

  p.log.warn(`Found ${orphanedPaths.length} orphaned file(s) to remove:`);
  for (const orphanedPath of orphanedPaths) {
    p.log.info(`  Removed: ${orphanedPath}`);
  }

  let shouldRemove = autoYes;
  if (!autoYes) {
    const confirmed = await p.confirm({
      message: `Remove ${orphanedPaths.length} orphaned file(s)?`,
      initialValue: true,
    });
    if (p.isCancel(confirmed)) {
      p.log.info("Skipped orphan removal.");
      shouldRemove = false;
    } else {
      shouldRemove = confirmed;
    }
  }

  if (!shouldRemove) {
    p.log.info("Orphan removal skipped.");
    return;
  }

  spinner.start("Removing orphaned files...");
  const removedCount = await removePlacedFiles(orphanedPaths, projectRoot);
  spinner.stop(`Removed ${removedCount} orphaned file(s)`);
}
