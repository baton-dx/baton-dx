import { mkdir, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import {
  type GitignoreSection,
  type LockFileEntry,
  type PlacementState,
  type ProjectManifest,
  atomicWriteFile,
  collectAiToolPatterns,
  collectFilePatterns,
  collectIdePatterns,
  ensureBatonDirGitignored,
  flattenPlacedFiles,
  generateLock,
  parseGitignoreConfig,
  readState,
  removeGitignoreManagedSection,
  removePlacedFiles,
  updateGitignoreWithSections,
  writeLock,
  writeState,
} from "@baton-dx/core";
import * as p from "@clack/prompts";

export type SyncCategory = "ai" | "files" | "ide";
export const validCategories: SyncCategory[] = ["ai", "files", "ide"];

export interface PlacedFileRecord {
  path: string;
  action: "created" | "updated" | "skipped";
}

export interface SyncStats {
  created: number;
  updated: number;
  skipped: number;
  removed: number;
  errors: number;
  details: PlacedFileRecord[];
}

/**
 * Create an initial SyncStats object.
 */
export function createSyncStats(): SyncStats {
  return { created: 0, updated: 0, skipped: 0, removed: 0, errors: 0, details: [] };
}

/**
 * Format a sync report summary line.
 * Default: "3 created, 2 updated, 12 skipped, 1 removed"
 * Verbose: additionally lists each file with its action.
 */
export function formatSyncReport(stats: SyncStats, verbose: boolean): string {
  const parts: string[] = [];
  if (stats.created > 0) parts.push(`${stats.created} created`);
  if (stats.updated > 0) parts.push(`${stats.updated} updated`);
  if (stats.skipped > 0) parts.push(`${stats.skipped} skipped`);
  if (stats.removed > 0) parts.push(`${stats.removed} removed`);
  if (stats.errors > 0) parts.push(`${stats.errors} error(s)`);

  const summary = parts.length > 0 ? parts.join(", ") : "no changes";

  if (!verbose || stats.details.length === 0) {
    return summary;
  }

  const fileLines = stats.details.map((d) => `  ${d.action}: ${d.path}`);
  return `${summary}\n${fileLines.join("\n")}`;
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
        await atomicWriteFile(targetPath, content);
        placed++;
      }
    }
  }

  return placed;
}

/**
 * Handle .gitignore update based on the project manifest's gitignore setting.
 *
 * Supports granular categories (ai-tools, ides, files) or a simple boolean.
 * When all categories are disabled: removes any existing managed section.
 * Always ensures .baton/ is gitignored regardless of setting.
 *
 * @param fileTargets - Placed file target paths from the `files` section of profiles.
 *   Only included in .gitignore patterns when `gitignore.files: true`.
 */
export async function handleGitignoreUpdate(params: {
  projectManifest: ProjectManifest;
  projectRoot: string;
  spinner: ReturnType<typeof p.spinner>;
  fileTargets?: string[];
}): Promise<void> {
  const { projectManifest, projectRoot, spinner, fileTargets = [] } = params;
  const config = parseGitignoreConfig(projectManifest.gitignore);

  // Always ensure .baton/ is gitignored
  await ensureBatonDirGitignored(projectRoot);

  const anyEnabled = config.aiTools || config.ides || config.files;

  if (anyEnabled) {
    spinner.start("Updating .gitignore...");
    const sections: GitignoreSection[] = [];
    if (config.aiTools) sections.push({ label: "ai-tools", patterns: collectAiToolPatterns() });
    if (config.ides) sections.push({ label: "ides", patterns: collectIdePatterns() });
    if (config.files && fileTargets.length > 0) {
      sections.push({ label: "files", patterns: collectFilePatterns(fileTargets) });
    }

    if (sections.every((s) => s.patterns.length === 0)) {
      spinner.stop(".gitignore unchanged (no patterns to write)");
      return;
    }

    const updated = await updateGitignoreWithSections(projectRoot, sections);
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
  batonVersion?: string;
}): Promise<void> {
  const { allProfiles, sourceShas, placedFiles, projectRoot, spinner, batonVersion } = params;

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

  const lockData = generateLock(lockPackages, batonVersion);
  await writeLock(lockData, resolve(projectRoot, "baton.lock"));

  spinner.stop("Lockfile updated");
}

/**
 * Write local placement state to `.baton/state.yaml`.
 * Tracks tool-specific file paths placed on disk for orphan detection,
 * categorized by type (ai-tools, ides, files).
 */
export async function writeStateData(params: {
  aiToolPaths: Set<string>;
  idePaths: Set<string>;
  filePaths: Set<string>;
  syncedAiTools: string[];
  mcpServers?: Record<string, string[]>;
  projectRoot: string;
  spinner: ReturnType<typeof p.spinner>;
}): Promise<void> {
  const { aiToolPaths, idePaths, filePaths, syncedAiTools, mcpServers, projectRoot, spinner } =
    params;

  spinner.start("Writing local state...");

  const state: PlacementState = {
    synced_at: new Date().toISOString(),
    tools: syncedAiTools,
    placed_files: {
      "ai-tools": [...aiToolPaths].sort(),
      ides: [...idePaths].sort(),
      files: [...filePaths].sort(),
    },
    ...(mcpServers && Object.keys(mcpServers).length > 0 ? { mcp_servers: mcpServers } : {}),
  };

  await writeState(projectRoot, state);
  spinner.stop("Local state updated");
}

/**
 * Load previous tool-specific paths for orphan detection.
 *
 * Reads exclusively from `.baton/state.yaml`. Returns an empty set when the file
 * is absent or fails schema validation (e.g. first sync after upgrade from an older
 * format). An empty set causes `cleanupOrphanedFiles` to skip orphan detection
 * entirely, which is the correct behaviour: no previous state means no known
 * previously-placed files to compare against.
 *
 * NOTE: The baton.lock file is NOT used as a fallback. Lockfile keys are always
 * canonical paths (e.g. `skills/code-review`, `memory/MEMORY.md`) — never
 * tool-specific disk paths. Using them as disk paths produces false-positive
 * orphans that are silently skipped by ENOENT handling, creating a confusing UX.
 *
 * Sync-Robustheit bei Profil-Änderungen:
 * - Profile hinzugefügt: Merge akkumuliert korrekt, Weight-Sorting löst Konflikte.
 * - Profile entfernt: Orphan-Detection vergleicht previousPaths (state.yaml) mit
 *   currentPaths → cleanupOrphanedFiles erkennt entfernte Dateien als orphaned.
 * - Kein state.yaml (fresh clone oder erstes Sync nach Upgrade): leeres Set →
 *   keine Orphan-Detection → korrekt. Nach dem nächsten Sync existiert state.yaml
 *   korrekt im neuen Format.
 */
export async function loadPreviousPlacedPaths(projectRoot: string): Promise<Set<string>> {
  const state = await readState(projectRoot);
  if (state) {
    return new Set(flattenPlacedFiles(state.placed_files));
  }
  // No valid state.yaml → no known previous paths → skip orphan detection
  return new Set();
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
}): Promise<number> {
  const { previousPaths, currentPaths, projectRoot, dryRun, autoYes, spinner } = params;

  if (previousPaths.size === 0) return 0;

  // Find orphaned paths (in previous state but not in current sync)
  const orphanedPaths = [...previousPaths].filter((prev) => !currentPaths.has(prev));
  if (orphanedPaths.length === 0) return 0;

  if (dryRun) {
    p.log.warn(`Would remove ${orphanedPaths.length} orphaned file(s):`);
    for (const orphanedPath of orphanedPaths) {
      p.log.info(`  Removed: ${orphanedPath}`);
    }
    return orphanedPaths.length;
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
    return 0;
  }

  spinner.start("Removing orphaned files...");
  const removedCount = await removePlacedFiles(orphanedPaths, projectRoot);
  spinner.stop(`Removed ${removedCount} orphaned file(s)`);
  return removedCount;
}
