import { resolve } from "node:path";
import type { IntersectionResult, SourceManifest } from "@baton-dx/core";
import {
    cloneGitSource,
    computeIntersection,
    findSourceManifest,
    getAuthenticatedUrl,
    loadProfileManifest,
    parseSource,
    resolveAuth,
    resolveProfileSupport,
} from "@baton-dx/core";
import { findSourceRoot } from "./context-detection.js";

/**
 * Compute the intersection for a single profile source string.
 * Shared utility used by sync, config, and manage commands.
 *
 * @returns IntersectionResult or null if intersection cannot be computed
 */
export async function buildIntersection(
    sourceString: string,
    developerTools: { aiTools: string[]; idePlatforms: string[] },
    cwd: string,
): Promise<IntersectionResult | null> {
    const parsed = parseSource(sourceString);

    let repoRoot: string;
    let profileDir: string;

    if (parsed.provider === "github" || parsed.provider === "gitlab") {
        const hostname = new URL(parsed.url).hostname;
        const auth = await resolveAuth(hostname);
        const cloneUrl =
            auth.method !== "none" ? await getAuthenticatedUrl(parsed.url, auth) : parsed.url;

        const repoClone = await cloneGitSource({
            url: cloneUrl,
            ref: parsed.ref,
            useCache: true,
            maxCacheAgeMs: 0,
            authToken: auth.token,
        });
        repoRoot = repoClone.localPath;
        profileDir = parsed.subpath ? resolve(repoRoot, parsed.subpath) : repoRoot;
    } else if (parsed.provider === "local" || parsed.provider === "file") {
        const absolutePath = parsed.path.startsWith("/") ? parsed.path : resolve(cwd, parsed.path);
        profileDir = absolutePath;
        repoRoot = (await findSourceRoot(absolutePath, { fallbackToStart: true })) as string;
    } else {
        return null;
    }

    // Load source manifest (optional)
    let sourceManifest: SourceManifest;
    try {
        sourceManifest = await findSourceManifest(repoRoot);
    } catch {
        sourceManifest = { name: "unknown", version: "0.0.0" } as SourceManifest;
    }

    // Load profile manifest
    const profileManifestPath = resolve(profileDir, "baton.profile.yaml");
    const profileManifest = await loadProfileManifest(profileManifestPath).catch(() => null);
    if (!profileManifest) return null;

    const profileSupport = resolveProfileSupport(profileManifest, sourceManifest);
    return computeIntersection(developerTools, profileSupport);
}
