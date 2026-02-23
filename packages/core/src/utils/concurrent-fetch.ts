import { dirname, resolve } from "node:path";
import type { CloneContext, ProjectManifest, ResolvedProfile } from "../index.js";
import { CircularInheritanceError, FileNotFoundError } from "../errors.js";
import {
  cloneGitSource,
  loadProfileManifest,
  parseSource,
  resolveVersion,
} from "./index.js";

export interface ProfileResolutionResult {
  profiles: ResolvedProfile[];
  sourceShas: Map<string, string>;
  errors: Array<{ source: string; error: Error }>;
}

interface ProfileSourceResolution {
  source: string;
  manifestPath: string;
  sha: string;
  localPath: string;
  cloneContext?: CloneContext;
}

async function resolveProfileSource(
  profileSource: { source: string; version?: string },
  projectRoot: string,
): Promise<ProfileSourceResolution> {
  const parsed = parseSource(profileSource.source);
  let manifestPath: string;
  let sha: string;
  let localPath: string;
  let cloneContext: CloneContext | undefined;

  if (parsed.provider === "local" || parsed.provider === "file") {
    const absolutePath = parsed.path.startsWith("/")
      ? parsed.path
      : resolve(projectRoot, parsed.path);
    manifestPath = resolve(absolutePath, "baton.profile.yaml");
    localPath = absolutePath;

    try {
      const { default: simpleGit } = await import("simple-git");
      const git = simpleGit(absolutePath);
      await git.checkIsRepo();
      sha = (await git.revparse(["HEAD"])).trim();
    } catch {
      sha = "local";
    }
  } else {
    const url =
      parsed.provider === "github" || parsed.provider === "gitlab"
        ? parsed.url
        : parsed.provider === "git"
          ? parsed.url
          : "";

    if (!url) {
      throw new Error(`Invalid source: ${profileSource.source}`);
    }

    let resolvedRef: string;
    try {
      resolvedRef = await resolveVersion(url, "latest");
    } catch {
      resolvedRef = profileSource.version || "HEAD";
    }

    const cloned = await cloneGitSource({
      url,
      ref: resolvedRef,
      subpath: "subpath" in parsed ? parsed.subpath : undefined,
      useCache: false,
    });

    manifestPath = resolve(cloned.localPath, "baton.profile.yaml");
    sha = cloned.sha;
    localPath = cloned.localPath;
    cloneContext = {
      cachePath: cloned.cachePath,
      sparseCheckout: cloned.sparseCheckout,
    };
  }

  return { source: profileSource.source, manifestPath, sha, localPath, cloneContext };
}

async function resolveSingleProfileChain(
  resolution: ProfileSourceResolution,
  resolvedProfiles: Map<string, ResolvedProfile>,
  visited: Set<string>,
  resolving: Set<string>,
): Promise<ResolvedProfile[]> {
  const { source, manifestPath, sha, localPath, cloneContext } = resolution;

  if (resolving.has(source)) {
    throw new CircularInheritanceError(`Circular inheritance detected: ${source}`);
  }

  if (resolvedProfiles.has(source)) {
    return [];
  }

  resolving.add(source);

  const manifest = await loadProfileManifest(manifestPath);
  const profileDir = dirname(manifestPath);
  const chain: ResolvedProfile[] = [];

  if (manifest.extends && manifest.extends.length > 0) {
    for (const parentSource of manifest.extends) {
      const parentResolution = await resolveProfileSource(
        { source: parentSource },
        localPath,
      );
      const parentChain = await resolveSingleProfileChain(
        parentResolution,
        resolvedProfiles,
        visited,
        resolving,
      );
      chain.push(...parentChain);
    }
  }

  const resolved: ResolvedProfile = {
    name: manifest.name,
    version: manifest.version,
    source,
    localPath,
    manifest,
    cloneContext,
  };

  resolvedProfiles.set(source, resolved);
  chain.push(resolved);
  resolving.delete(source);

  return chain;
}

export async function resolveProfilesConcurrently(
  projectManifest: ProjectManifest,
  projectRoot: string,
  concurrency = 5,
): Promise<ProfileResolutionResult> {
  const sources = projectManifest.profiles || [];
  const sourceShas = new Map<string, string>();
  const errors: Array<{ source: string; error: Error }> = [];
  const allProfiles: ResolvedProfile[] = [];
  const resolvedProfiles = new Map<string, ResolvedProfile>();

  const sourceBatches: Array<typeof sources> = [];
  for (let i = 0; i < sources.length; i += concurrency) {
    sourceBatches.push(sources.slice(i, i + concurrency));
  }

  for (const batch of sourceBatches) {
    const batchResults = await Promise.allSettled(
      batch.map(async (profileSource) => {
        const resolution = await resolveProfileSource(profileSource, projectRoot);
        return { profileSource, resolution };
      }),
    );

    const successfulResolutions: ProfileSourceResolution[] = [];

    for (let i = 0; i < batchResults.length; i++) {
      const result = batchResults[i];
      const source = batch[i].source;

      if (result.status === "fulfilled") {
        successfulResolutions.push(result.value.resolution);
        sourceShas.set(source, result.value.resolution.sha);
      } else {
        errors.push({
          source,
          error: result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
        });
      }
    }

    const chainResults = await Promise.allSettled(
      successfulResolutions.map((resolution) =>
        resolveSingleProfileChain(
          resolution,
          resolvedProfiles,
          new Set(),
          new Set(),
        ),
      ),
    );

    for (let i = 0; i < chainResults.length; i++) {
      const result = chainResults[i];
      if (result.status === "fulfilled") {
        allProfiles.push(...result.value);
      } else {
        errors.push({
          source: successfulResolutions[i].source,
          error: result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
        });
      }
    }
  }

  const deduplicated: ResolvedProfile[] = [];
  const seen = new Set<string>();
  for (const profile of allProfiles) {
    const key = `${profile.source}:${profile.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(profile);
    }
  }

  return { profiles: deduplicated, sourceShas, errors };
}

export async function fetchManifestsConcurrently<T>(
  urls: string[],
  fetcher: (url: string) => Promise<T>,
  concurrency = 5,
): Promise<Map<string, { data?: T; error?: Error }>> {
  const results = new Map<string, { data?: T; error?: Error }>();

  const batches: string[][] = [];
  for (let i = 0; i < urls.length; i += concurrency) {
    batches.push(urls.slice(i, i + concurrency));
  }

  for (const batch of batches) {
    const batchResults = await Promise.allSettled(
      batch.map(async (url) => ({
        url,
        result: await fetcher(url),
      })),
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.set(result.value.url, { data: result.value.result });
      } else {
        results.set((result.reason as { url?: string })?.url || "unknown", {
          error: result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
        });
      }
    }
  }

  return results;
}
