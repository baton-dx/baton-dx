import type { ParsedSource } from "../utils/index.js";

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
