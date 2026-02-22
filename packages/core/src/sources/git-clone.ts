import { createHash } from "node:crypto";
import { mkdir, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import simpleGit from "simple-git";
import { GitSourceError } from "../errors.js";

export interface CloneOptions {
  url: string;
  ref?: string;
  subpath?: string;
  useCache?: boolean;
  maxCacheAgeMs?: number;
}

export interface ClonedSource {
  localPath: string;
  fromCache: boolean;
  sha: string;
  cachePath: string;
  sparseCheckout: boolean;
}

const CACHE_DIR = join(homedir(), ".baton", "cache");

/**
 * Generates a cache key from source URL and ref
 */
function getCacheKey(url: string, ref?: string): string {
  const normalized = `${url}@${ref || "HEAD"}`;
  return createHash("sha256").update(normalized).digest("hex").substring(0, 16);
}

/**
 * Gets the full cache directory path for a given source
 */
function getCachePath(url: string, ref?: string): string {
  const key = getCacheKey(url, ref);
  return join(CACHE_DIR, key);
}

/**
 * Checks if a cached repository exists and is valid
 */
async function isCacheValid(cachePath: string): Promise<boolean> {
  try {
    const git = simpleGit(cachePath);
    // Check if the directory is a valid git repository
    await git.checkIsRepo();
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if a cached repository is stale based on FETCH_HEAD or HEAD mtime.
 * Falls back to .git/HEAD if FETCH_HEAD does not exist.
 */
async function isCacheStale(cachePath: string, maxAgeMs: number): Promise<boolean> {
  try {
    const fetchHeadPath = join(cachePath, ".git", "FETCH_HEAD");
    const fetchHeadStat = await stat(fetchHeadPath);
    return Date.now() - fetchHeadStat.mtimeMs > maxAgeMs;
  } catch {
    // FETCH_HEAD may not exist (first clone without fetch), fall back to HEAD
    try {
      const headPath = join(cachePath, ".git", "HEAD");
      const headStat = await stat(headPath);
      return Date.now() - headStat.mtimeMs > maxAgeMs;
    } catch {
      // Neither file exists — treat as stale
      return true;
    }
  }
}

/**
 * Clones a Git repository with shallow clone and optional sparse checkout
 */
export async function cloneGitSource(options: CloneOptions): Promise<ClonedSource> {
  const { url, ref, subpath, useCache = true, maxCacheAgeMs } = options;

  // Check cache first
  const cachePath = getCachePath(url, ref);
  if (useCache && (await isCacheValid(cachePath))) {
    const git = simpleGit(cachePath);
    try {
      const stale = maxCacheAgeMs !== undefined && (await isCacheStale(cachePath, maxCacheAgeMs));

      if (stale) {
        // Stale cache: aggressive refresh with fetch + reset
        try {
          await git.fetch(["--depth=1", "origin"]);
          await git.raw(["reset", "--hard", `origin/${ref || "HEAD"}`]);
        } catch {
          // Fetch failed (network issue), fall back to pull
          try {
            await git.pull(["--depth=1"]);
          } catch {
            // Pull also failed — use stale cache with warning
            console.warn(`[baton] Network unavailable, using stale cache for ${url}`);
          }
        }
      } else {
        // Cache is fresh or no TTL set: best-effort pull
        try {
          await git.pull(["--depth=1"]);
        } catch {
          // Pull failed (network issue, detached HEAD, etc.) - use cache as-is
        }
      }

      const sha = await git.revparse(["HEAD"]);
      return {
        localPath: subpath ? join(cachePath, subpath) : cachePath,
        fromCache: true,
        sha: sha.trim(),
        cachePath,
        sparseCheckout: !!subpath,
      };
    } catch (error) {
      throw new GitSourceError(
        `Failed to read cached repository: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }

  // Clean up old cache directory before cloning
  try {
    await rm(cachePath, { recursive: true, force: true });
  } catch (error) {
    // Ignore errors if directory doesn't exist
    if (error instanceof Error && "code" in error && error.code !== "ENOENT") {
      throw new GitSourceError(
        `Failed to clean up cache directory: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }

  // Ensure cache directory exists
  try {
    await mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    throw new GitSourceError(
      `Failed to create cache directory: ${error instanceof Error ? error.message : String(error)}`,
      error,
    );
  }

  const git = simpleGit();

  try {
    // Clone with shallow depth
    const cloneOptions: string[] = ["--depth=1"];
    const isSha = ref && /^[0-9a-f]{7,40}$/i.test(ref);

    // If ref is a branch/tag name (not a SHA), pass it to --branch
    if (ref && !isSha && ref !== "main" && ref !== "master") {
      cloneOptions.push("--branch", ref);
    }

    // Sparse checkout for subpath if specified
    if (subpath) {
      cloneOptions.push("--no-checkout");
    }

    await git.clone(url, cachePath, cloneOptions);
    const repoGit = simpleGit(cachePath);

    // For SHA refs: fetch the specific commit then checkout
    if (isSha) {
      await repoGit.fetch(["--depth=1", "origin", ref]);
      await repoGit.checkout("FETCH_HEAD");
    }

    // Configure sparse checkout if subpath is specified
    if (subpath) {
      await repoGit.raw(["sparse-checkout", "init", "--cone"]);
      await repoGit.raw(["sparse-checkout", "set", subpath]);
      if (!isSha) {
        await repoGit.checkout(ref || "HEAD");
      }
    } else if (ref && !isSha && ref !== "main" && ref !== "master") {
      // Checkout specific ref if needed (branch/tag, not SHA or sparse)
      await repoGit.checkout(ref);
    }

    // Get the current commit SHA
    const sha = await repoGit.revparse(["HEAD"]);

    return {
      localPath: subpath ? join(cachePath, subpath) : cachePath,
      fromCache: false,
      sha: sha.trim(),
      cachePath,
      sparseCheckout: !!subpath,
    };
  } catch (error) {
    throw new GitSourceError(
      `Failed to clone Git repository from ${url}: ${error instanceof Error ? error.message : String(error)}`,
      error,
    );
  }
}

/**
 * Expands sparse-checkout in a cached repository to include additional paths.
 * Uses 'git sparse-checkout add' to preserve existing checkout paths.
 */
export async function expandSparseCheckout(
  cachePath: string,
  additionalPaths: string[],
): Promise<void> {
  const git = simpleGit(cachePath);
  await git.raw(["sparse-checkout", "add", ...additionalPaths]);
}
