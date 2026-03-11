/**
 * File merge strategies for combining configuration files from multiple profiles.
 *
 * v2 only supports "replace". The "concat" strategy lives in content-parts.ts.
 * All legacy strategies (deep, append, prepend, skip, prompt, directory, import)
 * have been removed.
 */

/**
 * Merge strategy: replace
 * Target file is completely replaced with source content.
 */
export function mergeReplace(source: string, _target: string): string {
    return source;
}
