import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parse, stringify } from "yaml";
import { FileNotFoundError } from "../errors.js";
import type {
    FileMetadata,
    LockedPackage,
    LockFile,
    LockfileConfigType,
} from "../schemas/lockfile.js";
import { lockfileSchema } from "../schemas/lockfile.js";
import { atomicWriteFile } from "../utils/atomic-write.js";

/**
 * Metadata for a file to be recorded in the lockfile.
 * `content` is the raw source content (before tool transformation) — hashed to SHA-256.
 * `type` is the canonical config type (e.g., "skills", "memory", "commands").
 */
export interface LockFileEntry {
    content: string;
    type?: LockfileConfigType;
}

/**
 * Generates a lockfile object with locked_at timestamp and package metadata.
 *
 * Keys in the `files` map should be canonical paths (e.g., `skills/add-adapter`,
 * `memory/MEMORY.md`) — NOT tool-specific paths like `.claude/skills/add-adapter`.
 *
 * Files can be provided as plain strings (content only, backward compat)
 * or as LockFileEntry objects with canonical type annotations.
 */
export function generateLock(
    packages: Record<
        string,
        {
            source: string;
            resolved: string;
            version: string;
            sha: string;
            files: Record<string, string | LockFileEntry>;
        }
    >,
    batonVersion?: string,
): LockFile {
    const lockedPackages: Record<string, LockedPackage> = {};

    for (const [packageName, pkg] of Object.entries(packages)) {
        const integrity: Record<string, FileMetadata> = {};

        // Generate SHA-256 hashes for each file with canonical type metadata
        for (const [filename, fileData] of Object.entries(pkg.files)) {
            const isEntry = typeof fileData === "object";
            const content = isEntry ? fileData.content : fileData;
            const hash = createHash("sha256").update(content).digest("hex");

            integrity[filename] = {
                hash,
                type: isEntry ? fileData.type : undefined,
            };
        }

        lockedPackages[packageName] = {
            source: pkg.source,
            resolved: pkg.resolved,
            version: pkg.version,
            sha: pkg.sha,
            integrity,
        };
    }

    return {
        ...(batonVersion !== undefined ? { baton_version: batonVersion } : {}),
        locked_at: new Date().toISOString(),
        packages: lockedPackages,
    };
}

/**
 * Writes a lockfile object to disk as YAML
 */
export async function writeLock(lockfile: LockFile, filePath: string): Promise<void> {
    const yamlContent = stringify(lockfile);
    await atomicWriteFile(filePath, yamlContent);
}

/**
 * Reads and validates an existing lockfile from disk
 */
export async function readLock(filePath: string): Promise<LockFile> {
    try {
        const content = await readFile(filePath, "utf-8");
        const parsed = parse(content);
        const result = lockfileSchema.safeParse(parsed);

        if (!result.success) {
            throw new Error(
                `Invalid lockfile: ${result.error.errors.map((e) => e.message).join(", ")}`,
            );
        }

        return result.data;
    } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
            throw new FileNotFoundError(filePath);
        }
        throw error;
    }
}

/**
 * Compares current lockfile with remote state and returns list of changed packages
 */
export function compareLock(
    current: LockFile,
    remote: LockFile,
): Array<{ packageName: string; reason: string }> {
    const changes: Array<{ packageName: string; reason: string }> = [];

    // Check for packages in current that don't exist in remote
    for (const [packageName, currentPkg] of Object.entries(current.packages)) {
        const remotePkg = remote.packages[packageName];

        if (!remotePkg) {
            changes.push({ packageName, reason: "removed" });
            continue;
        }

        // Check SHA mismatch
        if (currentPkg.sha !== remotePkg.sha) {
            changes.push({ packageName, reason: "sha_mismatch" });
            continue;
        }

        // Check version mismatch
        if (currentPkg.version !== remotePkg.version) {
            changes.push({ packageName, reason: "version_changed" });
            continue;
        }

        // Check integrity (file hashes)
        const currentIntegrity = currentPkg.integrity;
        const remoteIntegrity = remotePkg.integrity;

        let changeDetected = false;

        // Check if files were removed
        for (const filename of Object.keys(currentIntegrity)) {
            if (!(filename in remoteIntegrity)) {
                changes.push({
                    packageName,
                    reason: `file_removed: ${filename}`,
                });
                changeDetected = true;
                break;
            }
        }

        if (changeDetected) continue;

        // Check if files were added
        for (const filename of Object.keys(remoteIntegrity)) {
            if (!(filename in currentIntegrity)) {
                changes.push({ packageName, reason: `file_added: ${filename}` });
                changeDetected = true;
                break;
            }
        }

        if (changeDetected) continue;

        // Check if files have changed (compare hash field from metadata objects)
        for (const [filename, currentEntry] of Object.entries(currentIntegrity)) {
            const remoteEntry = remoteIntegrity[filename];
            if (remoteEntry.hash !== currentEntry.hash) {
                changes.push({
                    packageName,
                    reason: `file_changed: ${filename}`,
                });
                break; // Only report once per package
            }
        }
    }

    // Check for packages in remote that don't exist in current
    for (const packageName of Object.keys(remote.packages)) {
        if (!(packageName in current.packages)) {
            changes.push({ packageName, reason: "added" });
        }
    }

    return changes;
}
