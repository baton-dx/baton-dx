import { gt, satisfies, valid, validRange } from "semver";
import type { LockFile } from "../schemas/lockfile.js";

/**
 * Check whether the installed Baton version is older than the version recorded in
 * the lockfile. Returns a warning message when an upgrade is needed, or `null`
 * when everything is fine (no version in lockfile, versions equal, or installed
 * is newer).
 *
 * Direction: lockfile version > installed → warn (the lockfile was created with a
 * newer tool and may rely on features the current installation does not support).
 * installed version > lockfile → silent (newer tool reading older lockfile is fine).
 */
export function checkLockfileVersion(lockfile: LockFile, currentVersion: string): string | null {
    const lockfileVersion = lockfile.baton_version;

    // No version in lockfile — old lockfile from before this feature, ignore.
    if (!lockfileVersion) return null;

    // Guard against non-semver values that could crash semver.gt
    if (!valid(lockfileVersion) || !valid(currentVersion)) return null;

    if (gt(lockfileVersion, currentVersion)) {
        return (
            `This lockfile was generated with Baton v${lockfileVersion}, ` +
            `but you are running v${currentVersion}. ` +
            `Update Baton to avoid potential compatibility issues.`
        );
    }

    return null;
}

/**
 * Check whether the installed Baton version satisfies a range declared in a
 * source manifest's `requires["baton-cli"]` field. Returns an error message
 * when the requirement is not met, or `null` when everything is fine.
 *
 * Invalid range strings (caught by validate-source Check 3) are silently
 * ignored here to avoid crashing at runtime.
 */
export function checkSourceBatonRequires(
    requiresRange: string,
    currentVersion: string,
): string | null {
    if (!validRange(requiresRange)) return null; // invalid range — caught by validation, skip here
    if (!valid(currentVersion)) return null; // non-semver runtime version — skip

    if (!satisfies(currentVersion, requiresRange)) {
        return (
            `This source requires baton-cli ${requiresRange}, ` +
            `but you are running v${currentVersion}. ` +
            `Update Baton to use this source.`
        );
    }
    return null;
}
