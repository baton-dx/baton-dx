import { access } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Check if the current directory is a source repository
 * A source repository contains a baton.source.yaml file in the root
 * @param cwd - Current working directory (defaults to process.cwd())
 * @returns true if baton.source.yaml exists in cwd, false otherwise
 */
export async function isInSourceRepo(cwd: string = process.cwd()): Promise<boolean> {
  const manifestPath = join(cwd, "baton.source.yaml");

  try {
    await access(manifestPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Find the source repository root by searching upwards from cwd
 * Checks the current directory and all parent directories for baton.source.yaml
 * @param cwd - Starting directory (defaults to process.cwd())
 * @param options.fallbackToStart - If true, return cwd instead of null when not found
 * @returns The absolute path to the source root, or null (or cwd) if not found
 */
export async function findSourceRoot(
  cwd: string = process.cwd(),
  options?: { fallbackToStart?: boolean },
): Promise<string | null> {
  let current = cwd;

  while (true) {
    const manifestPath = join(current, "baton.source.yaml");
    try {
      await access(manifestPath);
      return current;
    } catch {
      const parent = dirname(current);
      if (parent === current) {
        return options?.fallbackToStart ? cwd : null;
      }
      current = parent;
    }
  }
}
