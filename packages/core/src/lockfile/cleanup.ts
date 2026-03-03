import { readdir, rm, rmdir, stat, unlink } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";

/**
 * Removes placed files and directories, then cleans up empty parent directories.
 *
 * Handles both files and directories (fixes EISDIR bug where unlink fails on dirs).
 * Already-deleted paths (ENOENT) are silently skipped.
 * After each removal, walks up and removes empty parent directories up to projectRoot.
 *
 * @param filePaths - Paths to remove (relative to projectRoot or absolute)
 * @param projectRoot - Project root directory (parent cleanup stops here)
 * @returns Count of successfully removed items
 */
export async function removePlacedFiles(filePaths: string[], projectRoot: string): Promise<number> {
    let removedCount = 0;

    for (const filePath of filePaths) {
        const absolutePath = isAbsolute(filePath) ? filePath : resolve(projectRoot, filePath);

        try {
            const fileStat = await stat(absolutePath);

            if (fileStat.isDirectory()) {
                await rm(absolutePath, { recursive: true, force: true });
            } else {
                await unlink(absolutePath);
            }

            removedCount++;

            // Clean up empty parent directories up to (but not including) projectRoot
            let dir = dirname(absolutePath);
            while (dir !== projectRoot && dir.startsWith(projectRoot)) {
                try {
                    const entries = await readdir(dir);
                    if (entries.length === 0) {
                        await rmdir(dir);
                        dir = dirname(dir);
                    } else {
                        break;
                    }
                } catch {
                    break;
                }
            }
        } catch (error: unknown) {
            // Already deleted (ENOENT) — silently skip
            if (
                error instanceof Error &&
                "code" in error &&
                (error as NodeJS.ErrnoException).code === "ENOENT"
            ) {
                continue;
            }
            // Re-throw unexpected errors
            throw error;
        }
    }

    return removedCount;
}
