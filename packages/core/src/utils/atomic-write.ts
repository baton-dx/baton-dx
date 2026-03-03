import { rename, unlink, writeFile } from "node:fs/promises";

/**
 * Atomically write a file by writing to a temporary path first, then renaming.
 *
 * `rename()` is atomic on POSIX filesystems when source and target are on
 * the same filesystem. Using `${filePath}.baton-tmp` guarantees this.
 *
 * If writing or renaming fails, the temporary file is cleaned up.
 */
export async function atomicWriteFile(filePath: string, content: string): Promise<void> {
    const tmpPath = `${filePath}.baton-tmp`;
    try {
        await writeFile(tmpPath, content, "utf-8");
        await rename(tmpPath, filePath);
    } catch (error) {
        // Clean up temp file on failure (best-effort)
        try {
            await unlink(tmpPath);
        } catch {
            // Ignore cleanup errors (tmp may not exist)
        }
        throw error;
    }
}
