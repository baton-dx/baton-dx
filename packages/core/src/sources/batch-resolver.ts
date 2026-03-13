import { dirname, resolve } from "node:path";
import { GitAuthenticationError } from "../errors.js";
import type { CloneContext, ResolvedProfile } from "../inheritance/profile-chain.js";
import { resolveProfileChain } from "../inheritance/profile-chain.js";
import { checkSourceBatonRequires } from "../lockfile/version-check.js";
import type { LockedPackage, LockFile } from "../schemas/lockfile.js";
import type { ParsedSource } from "../utils/index.js";
import { expandLocalPath, loadProfileManifest, parseSource } from "../utils/index.js";
import type { AuthOptions, AuthResult } from "./auth-cascade.js";
import { cloneGitSource } from "./git-clone.js";
import { resolveNpmSource } from "./npm-resolver.js";
import { findSourceManifest } from "./source-discovery.js";
import { resolveVersion } from "./version-resolver.js";

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
                        queue.shift()?.();
                    });
            };
            if (active < concurrency) run();
            else queue.push(run);
        });
}

/** Find a locked package entry by matching on its `source` field. */
export function findLockedPackageBySource(
    lockfile: LockFile,
    source: string,
): LockedPackage | undefined {
    for (const pkg of Object.values(lockfile.packages)) {
        if (pkg.source === source) return pkg;
    }
    return undefined;
}

// ── Types ──────────────────────────────────────────────────────────────

export interface BatchResolveOptions {
    mode: "sync" | "apply";
    concurrency: number;
    lockfile?: LockFile;
    projectRoot: string;
    verbose?: boolean;
    logger?: { info: (msg: string) => void; warn: (msg: string) => void };
    resolveAuth: (hostname: string, options?: AuthOptions) => Promise<AuthResult>;
    getAuthenticatedUrl: (url: string, auth: AuthResult) => Promise<string>;
    currentVersion: string;
    maxCacheAgeMs?: number;
}

interface ProfileSource {
    source: string;
    version?: string;
}

export interface ResolvedSourceEntry {
    profileSource: ProfileSource;
    profiles: ResolvedProfile[];
    sha: string;
    auth?: { cloneUrl: string; authToken?: string };
    cloneContext?: CloneContext;
}

export interface SourceError {
    source: string;
    error: Error;
}

export interface BatchResolveResult {
    resolved: ResolvedSourceEntry[];
    errors: SourceError[];
    stats: {
        total: number;
        cached: number;
        cloned: number;
        local: number;
        failed: number;
    };
}

/** Thrown when a source requires a newer baton-cli version. Callers should exit immediately. */
export class VersionRequirementError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "VersionRequirementError";
    }
}

// ── Internal result for a single source resolution ─────────────────────

interface SourceResolution {
    manifestPath: string;
    sha: string;
    auth?: { cloneUrl: string; authToken?: string };
    cloneContext?: CloneContext;
}

interface ResolveContext {
    options: BatchResolveOptions;
    stats: BatchResolveResult["stats"];
    log: { info: (msg: string) => void; warn: (msg: string) => void };
    getAuth: (hostname: string, authOptions?: AuthOptions) => Promise<AuthResult>;
}

// ── Helpers (each handles one provider family) ─────────────────────────

async function resolveLocalSource(
    parsed: Extract<ParsedSource, { provider: "local" | "file" }>,
    ctx: ResolveContext,
): Promise<SourceResolution> {
    const absolutePath = expandLocalPath(parsed.path, ctx.options.projectRoot);
    const manifestPath = resolve(absolutePath, "baton.profile.yaml");
    let sha: string;
    try {
        const { createGit: makeGit } = await import("./git-utils.js");
        const git = makeGit(absolutePath);
        await git.checkIsRepo();
        const gitSha = await git.revparse(["HEAD"]);
        sha = gitSha.trim();
    } catch {
        sha = "local";
    }
    ctx.stats.local++;
    return { manifestPath, sha };
}

async function resolveNpmSourceEntry(
    parsed: Extract<ParsedSource, { provider: "npm" }>,
    ctx: ResolveContext,
): Promise<SourceResolution> {
    const resolved = await resolveNpmSource({
        source: parsed,
        basePath: ctx.options.projectRoot,
        useCache: false,
    });
    ctx.stats.cloned++;
    return {
        manifestPath: resolve(resolved.localPath, "baton.profile.yaml"),
        sha: resolved.version,
    };
}

function getGitUrl(parsed: ParsedSource): string {
    if (parsed.provider === "github" || parsed.provider === "gitlab" || parsed.provider === "git") {
        return parsed.url;
    }
    return "";
}

function getSubpath(parsed: ParsedSource): string | undefined {
    return "subpath" in parsed ? parsed.subpath : undefined;
}

async function resolveGitApply(
    profileSource: ProfileSource,
    parsed: ParsedSource,
    cloneUrl: string,
    authResult: AuthResult,
    ctx: ResolveContext,
): Promise<SourceResolution> {
    const { lockfile, maxCacheAgeMs, verbose } = ctx.options;
    let ref = profileSource.version;

    if (lockfile) {
        const lockedPkg = findLockedPackageBySource(lockfile, profileSource.source);
        if (lockedPkg?.sha && lockedPkg.sha !== "unknown") {
            ref = lockedPkg.sha;
            if (verbose)
                ctx.log.info(`Using locked SHA for ${profileSource.source}: ${ref?.slice(0, 12)}`);
        }
    }

    const cloned = await cloneGitSource({
        url: cloneUrl,
        ref,
        subpath: getSubpath(parsed),
        useCache: true,
        maxCacheAgeMs,
        authToken: authResult.token,
    });

    if (cloned.fromCache) ctx.stats.cached++;
    else ctx.stats.cloned++;

    return {
        manifestPath: resolve(cloned.localPath, "baton.profile.yaml"),
        sha: cloned.sha,
        auth: { cloneUrl, authToken: authResult.token },
        cloneContext: {
            cachePath: cloned.cachePath,
            sparseCheckout: cloned.sparseCheckout,
            authToken: authResult.token,
            cloneUrl,
        },
    };
}

async function resolveGitSync(
    profileSource: ProfileSource,
    parsed: ParsedSource,
    cloneUrl: string,
    url: string,
    authResult: AuthResult,
    ctx: ResolveContext,
): Promise<SourceResolution> {
    const { lockfile, verbose } = ctx.options;
    let useCache = false;
    let ref: string | undefined;

    // Resolve the latest ref (HEAD for unpinned sources, tag/branch for pinned)
    const spec = profileSource.version || "latest";
    try {
        ref = await resolveVersion(cloneUrl, spec, authResult.token);
        if (verbose)
            ctx.log.info(`Resolved ${spec}: ${profileSource.source} → ${ref.slice(0, 12)}`);
    } catch (error) {
        if (error instanceof GitAuthenticationError) {
            if (verbose) ctx.log.warn(`Auth failed for ${profileSource.source}`);
            return null as unknown as SourceResolution;
        }
        ref = profileSource.version || "HEAD";
        if (verbose) ctx.log.warn(`Could not resolve for ${url}, using ${ref}`);
    }

    // Compare resolved ref to locked SHA — use cache if identical
    if (lockfile && ref) {
        const lockedPkg = findLockedPackageBySource(lockfile, profileSource.source);
        if (lockedPkg?.sha && lockedPkg.sha !== "unknown" && lockedPkg.sha === ref) {
            useCache = true;
            if (verbose) ctx.log.info(`SHA unchanged for ${profileSource.source}, using cache`);
        }
    }

    const cloned = await cloneGitSource({
        url: cloneUrl,
        ref,
        subpath: getSubpath(parsed),
        useCache,
        authToken: authResult.token,
    });

    if (cloned.fromCache) ctx.stats.cached++;
    else ctx.stats.cloned++;

    return {
        manifestPath: resolve(cloned.localPath, "baton.profile.yaml"),
        sha: cloned.sha,
        auth: { cloneUrl, authToken: authResult.token },
        cloneContext: {
            cachePath: cloned.cachePath,
            sparseCheckout: cloned.sparseCheckout,
            authToken: authResult.token,
            cloneUrl,
        },
    };
}

async function resolveGitSource(
    profileSource: ProfileSource,
    parsed: ParsedSource,
    ctx: ResolveContext,
): Promise<SourceResolution | null> {
    const url = getGitUrl(parsed);
    if (!url) throw new Error(`Invalid source: ${profileSource.source}`);

    const hostname = new URL(url).hostname;
    const authResult = await ctx.getAuth(hostname);
    if (authResult.method === "none") {
        if (ctx.options.verbose)
            ctx.log.warn(`Skipping ${profileSource.source}: auth not configured`);
        return null;
    }
    const cloneUrl = await ctx.options.getAuthenticatedUrl(url, authResult);

    if (ctx.options.mode === "apply") {
        return resolveGitApply(profileSource, parsed, cloneUrl, authResult, ctx);
    }
    return resolveGitSync(profileSource, parsed, cloneUrl, url, authResult, ctx);
}

// ── Main batch resolver ────────────────────────────────────────────────

export async function resolveSourcesBatch(
    sources: ProfileSource[],
    options: BatchResolveOptions,
): Promise<BatchResolveResult> {
    const { concurrency, currentVersion } = options;
    const limit = pLimit(concurrency);
    const log = options.logger ?? { info: () => {}, warn: () => {} };
    const stats: BatchResolveResult["stats"] = {
        total: sources.length,
        cached: 0,
        cloned: 0,
        local: 0,
        failed: 0,
    };
    const errors: SourceError[] = [];
    const checkedSourceRoots = new Set<string>();

    // Deduplicate auth per hostname
    const authCache = new Map<string, Promise<AuthResult>>();
    const getAuth = (hostname: string, authOptions?: AuthOptions): Promise<AuthResult> => {
        if (!authCache.has(hostname)) {
            authCache.set(hostname, options.resolveAuth(hostname, authOptions));
        }
        // Safe: we just set it if absent
        return authCache.get(hostname) as Promise<AuthResult>;
    };

    const ctx: ResolveContext = { options, stats, log, getAuth };

    const resolveOne = async (
        profileSource: ProfileSource,
    ): Promise<ResolvedSourceEntry | null> => {
        if (options.verbose) log.info(`Resolving source: ${profileSource.source}`);
        const parsed = parseSource(profileSource.source);

        let resolution: SourceResolution | null;

        if (parsed.provider === "local" || parsed.provider === "file") {
            resolution = await resolveLocalSource(parsed, ctx);
        } else if (parsed.provider === "npm") {
            resolution = await resolveNpmSourceEntry(parsed, ctx);
        } else {
            resolution = await resolveGitSource(profileSource, parsed, ctx);
        }

        if (!resolution) return null;

        const { manifestPath, sha, auth, cloneContext } = resolution;
        const manifest = await loadProfileManifest(manifestPath);
        const profileDir = dirname(manifestPath);

        // Check baton-cli version requirement once per source root
        const sourceRoot = resolve(profileDir, "../..");
        if (!checkedSourceRoots.has(sourceRoot)) {
            checkedSourceRoots.add(sourceRoot);
            const sourceMeta = await findSourceManifest(sourceRoot).catch(() => null);
            const requiresBatonCli = sourceMeta?.requires?.["baton-cli"];
            if (requiresBatonCli) {
                const err = checkSourceBatonRequires(requiresBatonCli, currentVersion);
                if (err) throw new VersionRequirementError(err);
            }
        }

        const chain = await resolveProfileChain(
            manifest,
            profileSource.source,
            profileDir,
            cloneContext,
        );

        return { profileSource, profiles: chain, sha, auth, cloneContext };
    };

    // Partition: local/file sources run inline, remote sources run through pLimit
    const tasks = sources.map((source) => {
        const parsed = parseSource(source.source);
        const isLocal = parsed.provider === "local" || parsed.provider === "file";

        const task = async (): Promise<ResolvedSourceEntry | null> => {
            try {
                return await resolveOne(source);
            } catch (error) {
                if (error instanceof VersionRequirementError) throw error;
                errors.push({
                    source: source.source,
                    error: error instanceof Error ? error : new Error(String(error)),
                });
                stats.failed++;
                return null;
            }
        };

        return isLocal ? task() : limit(task);
    });

    const results = await Promise.all(tasks);
    const resolved = results.filter((r): r is ResolvedSourceEntry => r !== null);

    return { resolved, errors, stats };
}
