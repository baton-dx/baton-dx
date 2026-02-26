import { createHash } from "node:crypto";
import { access, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { FileNotFoundError } from "../errors.js";
import { readLock } from "../lockfile/manager.js";
import { flattenPlacedFiles, readState } from "../state/state.js";

export interface StaleCheckResult {
  stale: boolean;
  reasons: string[];
}

/**
 * Check if the project's placed configurations are stale (out of sync).
 *
 * Performs local-only checks (no network) for fast CI usage:
 * 1. Lockfile existence and validity
 * 2. State file existence and validity
 * 3. All placed files still exist on disk
 * 4. baton.yaml modified after last sync
 * 5. File integrity for `files` category (SHA-256 hash comparison)
 */
export async function checkStale(projectRoot: string): Promise<StaleCheckResult> {
  const reasons: string[] = [];

  // Check 1: Lockfile exists and is valid
  const lockfilePath = resolve(projectRoot, "baton.lock");
  let lockfile: Awaited<ReturnType<typeof readLock>> | null = null;
  try {
    lockfile = await readLock(lockfilePath);
  } catch (error) {
    if (error instanceof FileNotFoundError) {
      reasons.push("baton.lock not found — run `baton sync` first");
    } else {
      reasons.push(
        `baton.lock is invalid: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Check 2: State file exists and is valid
  const state = await readState(projectRoot);
  if (!state) {
    reasons.push(".baton/state.yaml not found or invalid — run `baton sync` first");
  }

  // Check 3: All placed files still exist on disk
  if (state) {
    const allPaths = flattenPlacedFiles(state.placed_files);
    for (const filePath of allPaths) {
      const absolutePath = resolve(projectRoot, filePath);
      try {
        await access(absolutePath);
      } catch {
        reasons.push(`Missing placed file: ${filePath}`);
      }
    }
  }

  // Check 4: baton.yaml modified after last sync
  if (state) {
    const batonYamlPath = resolve(projectRoot, "baton.yaml");
    try {
      const batonYamlStat = await stat(batonYamlPath);
      const syncedAt = new Date(state.synced_at);
      if (batonYamlStat.mtime > syncedAt) {
        reasons.push("baton.yaml has been modified since last sync");
      }
    } catch {
      reasons.push("baton.yaml not found");
    }
  }

  // Check 5: File integrity for `files` category
  // Only check files from the `files` category — these are 1:1 copies without
  // tool-specific transformation, so disk content should match lockfile hashes.
  if (lockfile && state && state.placed_files.files.length > 0) {
    for (const [, pkg] of Object.entries(lockfile.packages)) {
      for (const [canonicalKey, metadata] of Object.entries(pkg.integrity)) {
        if (metadata.type !== "files") continue;

        // Extract target path from canonical key (e.g., "files/biome.json" → "biome.json")
        const targetPath = canonicalKey.replace(/^files\//, "");
        const absolutePath = resolve(projectRoot, targetPath);

        try {
          const content = await readFile(absolutePath, "utf-8");
          const diskHash = createHash("sha256").update(content).digest("hex");
          if (diskHash !== metadata.hash) {
            reasons.push(`File integrity mismatch: ${targetPath}`);
          }
        } catch {
          // File missing — already caught in Check 3
        }
      }
    }
  }

  return {
    stale: reasons.length > 0,
    reasons,
  };
}
