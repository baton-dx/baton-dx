import type { ParsedSource } from "../utils/index.js";
import { createGit, isAuthError, withTokenAuth } from "./git-utils.js";

/**
 * Simple concurrency limiter. No external dependency.
 * Returns a function that wraps async tasks with a concurrency gate.
 */
export function pLimit(concurrency: number): <T>(fn: () => Promise<T>) => Promise<T> {
    const queue: Array<() => void> = [];
    let active = 0;

    return <T>(fn: () => Promise<T>): Promise<T> =>
        new Promise<T>((resolve, reject) => {
            const run = () => {
                active++;
                fn()
                    .then(resolve, reject)
                    .finally(() => {
                        active--;
                        if (queue.length > 0) queue.shift()!();
                    });
            };
            if (active < concurrency) run();
            else queue.push(run);
        });
}

/** Extract the package name from a source string for lockfile lookup. */
export function getPackageNameFromSource(source: string, parsed: ParsedSource): string {
    if (parsed.provider === "github" || parsed.provider === "gitlab") {
        return `${parsed.org}/${parsed.repo}`;
    }
    if (parsed.provider === "npm") {
        return parsed.package;
    }
    if (parsed.provider === "git") {
        return parsed.url;
    }
    return source;
}

export type RemoteCheckResult =
    | { type: "ok"; changed: boolean }
    | { type: "auth_error"; error: Error }
    | { type: "network_error" };

/**
 * Lightweight remote SHA check via `git ls-remote`.
 * Compares the given lockedSha against all remote refs.
 * If the lockedSha is found in any remote ref, the source is unchanged.
 *
 * Note: For annotated tags, ls-remote returns the tag object SHA, not the
 * dereferenced commit SHA. This means a lockfile SHA pointing to a commit
 * behind an annotated tag may show as "changed" — an acceptable false-positive
 * that triggers a fresh clone (safe, no stale data risk).
 */
export async function checkRemoteSha(
    url: string,
    lockedSha: string,
    authToken?: string,
): Promise<RemoteCheckResult> {
    try {
        const git = authToken ? withTokenAuth(createGit(), url, authToken) : createGit();
        const remoteRefs = await git.listRemote(["--heads", "--tags", "--refs", url]);

        // Check if the locked SHA appears in any remote ref
        for (const line of remoteRefs.split("\n")) {
            const match = line.match(/^([a-f0-9]+)\s+refs\//);
            if (match && match[1] === lockedSha) {
                return { type: "ok", changed: false };
            }
        }

        return { type: "ok", changed: true };
    } catch (error) {
        if (isAuthError(error)) {
            return {
                type: "auth_error",
                error: error instanceof Error ? error : new Error(String(error)),
            };
        }
        return { type: "network_error" };
    }
}
