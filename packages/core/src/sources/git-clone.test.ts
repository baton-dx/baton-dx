import { createHash } from "node:crypto";
import { rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { SimpleGit } from "simple-git";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GitAuthenticationError, GitSourceError } from "../errors.js";
import { cloneGitSource, expandSparseCheckout } from "./git-clone.js";
import * as gitUtils from "./git-utils.js";

vi.mock("node:fs/promises", async (importOriginal) => ({
    ...(await importOriginal<typeof import("node:fs/promises")>()),
    stat: vi.fn(),
    rm: vi.fn(),
}));

const CACHE_DIR = join(homedir(), ".baton", "cache");

function getCachePath(url: string, ref?: string): string {
    const normalized = `${url}@${ref || "HEAD"}`;
    return join(CACHE_DIR, createHash("sha256").update(normalized).digest("hex").substring(0, 16));
}

async function clearCache(url: string, ref?: string): Promise<void> {
    await rm(getCachePath(url, ref), { recursive: true, force: true });
}

// These tests are covered by git-integration.test.ts which handles concurrent access better
// Skipping to avoid race conditions with parallel test execution
describe.skip("cloneGitSource", () => {
    const testUrl = "https://github.com/anthropics/courses.git";

    beforeEach(async () => {
        // Clean up cache before each test to ensure fresh state
        await clearCache(testUrl);
        await clearCache(testUrl, "main");
    });

    it("clones a public GitHub repository", async () => {
        const result = await cloneGitSource({
            url: testUrl,
            useCache: true,
        });

        expect(result.localPath).toBeDefined();
        expect(result.fromCache).toBe(false);
        expect(result.sha).toMatch(/^[0-9a-f]{40}$/);
    }, 30000); // 30s timeout for network request

    it("uses cache on second fetch of same repository", async () => {
        const options = {
            url: testUrl,
            useCache: true,
        };

        // First clone
        const firstResult = await cloneGitSource(options);
        expect(firstResult.fromCache).toBe(false);

        // Second clone (should use cache)
        const secondResult = await cloneGitSource(options);
        expect(secondResult.fromCache).toBe(true);
        expect(secondResult.sha).toBe(firstResult.sha);
    }, 60000); // 60s timeout for two network requests

    it("throws GitSourceError for invalid repository URL", async () => {
        await expect(
            cloneGitSource({
                url: "https://github.com/nonexistent/invalid-repo-xyz-12345.git",
                useCache: false,
            }),
        ).rejects.toThrow(GitSourceError);
    }, 30000);

    it("clones a specific ref (tag)", async () => {
        const result = await cloneGitSource({
            url: testUrl,
            ref: "main",
            useCache: false,
        });

        expect(result.localPath).toBeDefined();
        expect(result.sha).toMatch(/^[0-9a-f]{40}$/);
    }, 30000);

    it("handles sparse checkout for subpath", async () => {
        const result = await cloneGitSource({
            url: testUrl,
            subpath: "prompting_examples_course",
            useCache: false,
        });

        expect(result.localPath).toContain("prompting_examples_course");
        expect(result.sha).toMatch(/^[0-9a-f]{40}$/);
    }, 30000);

    it("invalidates cache correctly", async () => {
        // Clone first
        await cloneGitSource({ url: testUrl, useCache: true });

        // Invalidate cache
        await clearCache(testUrl);

        // Next clone should be from scratch
        const result = await cloneGitSource({ url: testUrl, useCache: true });
        expect(result.fromCache).toBe(false);
    }, 60000);

    it("generates consistent cache keys for same URL and ref", async () => {
        const options = {
            url: testUrl,
            ref: "main",
            useCache: true,
        };

        const firstResult = await cloneGitSource(options);
        const secondResult = await cloneGitSource(options);

        expect(firstResult.localPath).toBe(secondResult.localPath);
    }, 60000);
});

describe.skip("cache management", () => {
    const testUrl = "https://github.com/anthropics/courses.git";

    beforeEach(async () => {
        // Clean up cache before each test
        await clearCache(testUrl);
    });

    it("creates cache directory if it doesn't exist", async () => {
        // This test verifies cache creation happens automatically
        const result = await cloneGitSource({
            url: testUrl,
            useCache: true,
        });

        expect(result.localPath).toContain(join(homedir(), ".baton", "cache"));
    }, 30000);

    it("does not use cache when useCache is false", async () => {
        const options = {
            url: testUrl,
            useCache: false,
        };

        const result = await cloneGitSource(options);
        expect(result.fromCache).toBe(false);
    }, 30000);
});

// Unit tests with mocked git-utils
vi.mock("./git-utils.js");

describe("expandSparseCheckout", () => {
    let mockRaw: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockRaw = vi.fn().mockResolvedValue("");
        vi.mocked(gitUtils.createGit).mockReturnValue({
            raw: mockRaw,
        } as unknown as SimpleGit);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("calls git sparse-checkout add with additional paths", async () => {
        await expandSparseCheckout("/cache/abc123", ["profiles/base", "profiles/team"]);

        expect(gitUtils.createGit).toHaveBeenCalledWith("/cache/abc123");
        expect(mockRaw).toHaveBeenCalledWith([
            "sparse-checkout",
            "add",
            "profiles/base",
            "profiles/team",
        ]);
    });

    it("uses 'add' not 'set' to preserve existing checkout paths", async () => {
        await expandSparseCheckout("/cache/abc123", ["profiles/new"]);

        const rawArgs = mockRaw.mock.calls[0][0] as string[];
        expect(rawArgs[0]).toBe("sparse-checkout");
        expect(rawArgs[1]).toBe("add");
        expect(rawArgs).not.toContain("set");
    });
});

describe("ClonedSource interface fields", () => {
    let mockCheckIsRepo: ReturnType<typeof vi.fn>;
    let mockPull: ReturnType<typeof vi.fn>;
    let mockRevparse: ReturnType<typeof vi.fn>;
    let mockClone: ReturnType<typeof vi.fn>;
    let mockRaw: ReturnType<typeof vi.fn>;
    let mockCheckout: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockCheckIsRepo = vi.fn().mockResolvedValue(true);
        mockPull = vi.fn().mockResolvedValue(undefined);
        mockRevparse = vi.fn().mockResolvedValue("abc123def456abc123def456abc123def456abc123");
        mockClone = vi.fn().mockResolvedValue(undefined);
        mockRaw = vi.fn().mockResolvedValue("");
        mockCheckout = vi.fn().mockResolvedValue(undefined);

        const mockGit = {
            checkIsRepo: mockCheckIsRepo,
            pull: mockPull,
            revparse: mockRevparse,
            clone: mockClone,
            raw: mockRaw,
            checkout: mockCheckout,
        } as unknown as SimpleGit;

        vi.mocked(gitUtils.createGit).mockReturnValue(mockGit);
        vi.mocked(gitUtils.createInteractiveGit).mockReturnValue(mockGit);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("includes cachePath and sparseCheckout: false when no subpath (cache hit)", async () => {
        const result = await cloneGitSource({
            url: "https://example.com/repo.git",
            useCache: true,
        });

        expect(result.cachePath).toBeDefined();
        expect(typeof result.cachePath).toBe("string");
        expect(result.sparseCheckout).toBe(false);
    });

    it("includes cachePath and sparseCheckout: true when subpath is set (cache hit)", async () => {
        const result = await cloneGitSource({
            url: "https://example.com/repo.git",
            subpath: "profiles/team",
            useCache: true,
        });

        expect(result.cachePath).toBeDefined();
        expect(result.sparseCheckout).toBe(true);
        expect(result.localPath).toContain("profiles/team");
    });

    it("includes cachePath and sparseCheckout on fresh clone without subpath", async () => {
        // First call: isCacheValid → checkIsRepo throws (no cache)
        mockCheckIsRepo.mockRejectedValueOnce(new Error("not a git repo"));

        const result = await cloneGitSource({
            url: "https://example.com/repo.git",
            useCache: true,
        });

        expect(result.cachePath).toBeDefined();
        expect(result.sparseCheckout).toBe(false);
        expect(result.fromCache).toBe(false);
    });

    it("includes cachePath and sparseCheckout: true on fresh clone with subpath", async () => {
        // First call: isCacheValid → checkIsRepo throws (no cache)
        mockCheckIsRepo.mockRejectedValueOnce(new Error("not a git repo"));

        const result = await cloneGitSource({
            url: "https://example.com/repo.git",
            subpath: "profiles/team",
            useCache: true,
        });

        expect(result.cachePath).toBeDefined();
        expect(result.sparseCheckout).toBe(true);
        expect(result.fromCache).toBe(false);
    });

    it("throws GitAuthenticationError when clone fails with auth error", async () => {
        // First two calls: isCacheValid → checkIsRepo throws (no cache)
        mockCheckIsRepo.mockRejectedValueOnce(new Error("not a git repo"));
        mockCheckIsRepo.mockRejectedValueOnce(new Error("not a git repo"));

        mockClone.mockRejectedValueOnce(new Error("terminal prompts disabled"));
        vi.mocked(gitUtils.isAuthError).mockReturnValue(true);

        await expect(
            cloneGitSource({
                url: "https://example.com/private-repo.git",
                useCache: false,
            }),
        ).rejects.toThrow(GitAuthenticationError);
    });
});

describe("cache staleness", () => {
    const mockStat = vi.mocked(stat);
    let mockCheckIsRepo: ReturnType<typeof vi.fn>;
    let mockPull: ReturnType<typeof vi.fn>;
    let mockFetch: ReturnType<typeof vi.fn>;
    let mockRaw: ReturnType<typeof vi.fn>;
    let mockRevparse: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockCheckIsRepo = vi.fn().mockResolvedValue(true);
        mockPull = vi.fn().mockResolvedValue(undefined);
        mockFetch = vi.fn().mockResolvedValue(undefined);
        mockRaw = vi.fn().mockResolvedValue("");
        mockRevparse = vi.fn().mockResolvedValue("abc123def456abc123def456abc123def456abc123");

        const mockGit = {
            checkIsRepo: mockCheckIsRepo,
            pull: mockPull,
            fetch: mockFetch,
            raw: mockRaw,
            revparse: mockRevparse,
        } as unknown as SimpleGit;

        vi.mocked(gitUtils.createGit).mockReturnValue(mockGit);
        vi.mocked(gitUtils.createInteractiveGit).mockReturnValue(mockGit);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("triggers fetch+reset when cache is stale", async () => {
        // FETCH_HEAD mtime is 2 hours ago, TTL is 1 hour
        const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
        mockStat.mockResolvedValueOnce({
            mtimeMs: twoHoursAgo,
        } as Awaited<ReturnType<typeof stat>>);

        await cloneGitSource({
            url: "https://example.com/repo.git",
            useCache: true,
            maxCacheAgeMs: 60 * 60 * 1000, // 1 hour
        });

        expect(mockFetch).toHaveBeenCalledWith(["--depth=1", "origin"]);
        expect(mockRaw).toHaveBeenCalledWith(["reset", "--hard", "origin/HEAD"]);
        expect(mockPull).not.toHaveBeenCalled();
    });

    it("triggers fetch+reset with correct ref when stale", async () => {
        const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
        mockStat.mockResolvedValueOnce({
            mtimeMs: twoHoursAgo,
        } as Awaited<ReturnType<typeof stat>>);

        await cloneGitSource({
            url: "https://example.com/repo.git",
            ref: "main",
            useCache: true,
            maxCacheAgeMs: 60 * 60 * 1000,
        });

        expect(mockRaw).toHaveBeenCalledWith(["reset", "--hard", "origin/main"]);
    });

    it("skips fetch when cache is fresh", async () => {
        // FETCH_HEAD mtime is 10 minutes ago, TTL is 1 hour
        const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
        mockStat.mockResolvedValueOnce({
            mtimeMs: tenMinutesAgo,
        } as Awaited<ReturnType<typeof stat>>);

        await cloneGitSource({
            url: "https://example.com/repo.git",
            useCache: true,
            maxCacheAgeMs: 60 * 60 * 1000, // 1 hour
        });

        // Should use normal pull path, not fetch+reset
        expect(mockFetch).not.toHaveBeenCalled();
        expect(mockPull).toHaveBeenCalledWith(["--depth=1"]);
    });

    it("falls back to pull when fetch fails on stale cache", async () => {
        const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
        mockStat.mockResolvedValueOnce({
            mtimeMs: twoHoursAgo,
        } as Awaited<ReturnType<typeof stat>>);

        // Fetch fails (network issue)
        mockFetch.mockRejectedValueOnce(new Error("network error"));

        await cloneGitSource({
            url: "https://example.com/repo.git",
            useCache: true,
            maxCacheAgeMs: 60 * 60 * 1000,
        });

        expect(mockFetch).toHaveBeenCalled();
        expect(mockPull).toHaveBeenCalledWith(["--depth=1"]);
    });

    it("uses stale cache with warning when both fetch and pull fail", async () => {
        const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
        mockStat.mockResolvedValueOnce({
            mtimeMs: twoHoursAgo,
        } as Awaited<ReturnType<typeof stat>>);

        mockFetch.mockRejectedValueOnce(new Error("network error"));
        mockPull.mockRejectedValueOnce(new Error("network error"));

        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        const result = await cloneGitSource({
            url: "https://example.com/repo.git",
            useCache: true,
            maxCacheAgeMs: 60 * 60 * 1000,
        });

        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Network unavailable"));
        expect(result.fromCache).toBe(true);
        warnSpy.mockRestore();
    });

    it("falls back to HEAD mtime when FETCH_HEAD does not exist", async () => {
        // First stat (FETCH_HEAD) fails, second (HEAD) succeeds with stale time
        const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
        mockStat.mockRejectedValueOnce(new Error("ENOENT")).mockResolvedValueOnce({
            mtimeMs: twoHoursAgo,
        } as Awaited<ReturnType<typeof stat>>);

        await cloneGitSource({
            url: "https://example.com/repo.git",
            useCache: true,
            maxCacheAgeMs: 60 * 60 * 1000,
        });

        // Should have triggered fetch+reset since HEAD is stale
        expect(mockFetch).toHaveBeenCalledWith(["--depth=1", "origin"]);
    });

    it("uses maxCacheAgeMs: 0 to always force fetch", async () => {
        // Even a very recent mtime should be stale with TTL=0
        const justNow = Date.now() - 100; // 100ms ago
        mockStat.mockResolvedValueOnce({
            mtimeMs: justNow,
        } as Awaited<ReturnType<typeof stat>>);

        await cloneGitSource({
            url: "https://example.com/repo.git",
            useCache: true,
            maxCacheAgeMs: 0,
        });

        expect(mockFetch).toHaveBeenCalledWith(["--depth=1", "origin"]);
    });

    it("uses normal pull when maxCacheAgeMs is not set", async () => {
        await cloneGitSource({
            url: "https://example.com/repo.git",
            useCache: true,
        });

        // No stat check, no fetch — just best-effort pull
        expect(mockStat).not.toHaveBeenCalled();
        expect(mockFetch).not.toHaveBeenCalled();
        expect(mockPull).toHaveBeenCalledWith(["--depth=1"]);
    });

    it("fetches specific SHA and resets to FETCH_HEAD when ref is a commit SHA", async () => {
        const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
        mockStat.mockResolvedValueOnce({
            mtimeMs: twoHoursAgo,
        } as Awaited<ReturnType<typeof stat>>);

        const sha = "abc1234567890def1234567890abcdef12345678";
        await cloneGitSource({
            url: "https://example.com/sha-ref.git",
            ref: sha,
            useCache: true,
            maxCacheAgeMs: 60 * 60 * 1000,
        });

        // SHA ref: should fetch the specific commit, not just origin
        expect(mockFetch).toHaveBeenCalledWith(["--depth=1", "origin", sha]);
        // Should reset to FETCH_HEAD, not origin/<sha>
        expect(mockRaw).toHaveBeenCalledWith(["reset", "--hard", "FETCH_HEAD"]);
    });
});

describe("cache cleanup retry (rmRobust)", () => {
    const mockRm = vi.mocked(rm);

    let mockCheckIsRepo: ReturnType<typeof vi.fn>;
    let mockClone: ReturnType<typeof vi.fn>;
    let mockRevparse: ReturnType<typeof vi.fn>;
    let mockRaw: ReturnType<typeof vi.fn>;
    let mockCheckout: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        // Both isCacheValid checks must fail so we reach the rm + fresh clone path
        mockCheckIsRepo = vi
            .fn()
            .mockRejectedValueOnce(new Error("not a git repo"))
            .mockRejectedValueOnce(new Error("not a git repo"));
        mockClone = vi.fn().mockResolvedValue(undefined);
        mockRevparse = vi.fn().mockResolvedValue("abc123def456abc123def456abc123def456abc123");
        mockRaw = vi.fn().mockResolvedValue("");
        mockCheckout = vi.fn().mockResolvedValue(undefined);

        const mockGit = {
            checkIsRepo: mockCheckIsRepo,
            clone: mockClone,
            revparse: mockRevparse,
            raw: mockRaw,
            checkout: mockCheckout,
        } as unknown as SimpleGit;

        vi.mocked(gitUtils.createGit).mockReturnValue(mockGit);
        vi.mocked(gitUtils.createInteractiveGit).mockReturnValue(mockGit);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("retries rm on ENOTEMPTY and succeeds", async () => {
        const enotempty = Object.assign(new Error("ENOTEMPTY"), { code: "ENOTEMPTY" });
        mockRm.mockRejectedValueOnce(enotempty).mockResolvedValueOnce(undefined);

        const result = await cloneGitSource({
            url: "https://example.com/enotempty-retry.git",
            useCache: false,
        });

        expect(mockRm).toHaveBeenCalledTimes(2);
        expect(result.sha).toBeDefined();
    });

    it("throws GitSourceError when rm exhausts retries", async () => {
        const enotempty = Object.assign(new Error("ENOTEMPTY"), { code: "ENOTEMPTY" });
        mockRm
            .mockRejectedValueOnce(enotempty)
            .mockRejectedValueOnce(enotempty)
            .mockRejectedValueOnce(enotempty);

        await expect(
            cloneGitSource({
                url: "https://example.com/enotempty-fail.git",
                useCache: false,
            }),
        ).rejects.toThrow(GitSourceError);
    });

    it("treats ENOENT as success (directory already gone)", async () => {
        const enoent = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
        mockRm.mockRejectedValueOnce(enoent);

        const result = await cloneGitSource({
            url: "https://example.com/enoent-ok.git",
            useCache: false,
        });

        expect(mockRm).toHaveBeenCalledTimes(1);
        expect(result.sha).toBeDefined();
    });
});

describe("cache-hit fallthrough on transient error", () => {
    const mockRm = vi.mocked(rm);
    let mockCheckIsRepo: ReturnType<typeof vi.fn>;
    let mockPull: ReturnType<typeof vi.fn>;
    let mockRevparse: ReturnType<typeof vi.fn>;
    let mockClone: ReturnType<typeof vi.fn>;
    let mockRaw: ReturnType<typeof vi.fn>;
    let mockCheckout: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockCheckIsRepo = vi
            .fn()
            .mockResolvedValueOnce(true) // 1st isCacheValid → cache hit
            .mockRejectedValueOnce(new Error("not a git repo")); // 2nd isCacheValid → cache gone
        mockPull = vi.fn().mockResolvedValue(undefined);
        mockRevparse = vi
            .fn()
            .mockRejectedValueOnce(new Error("spawn git ENOENT")) // cache-hit revparse fails
            .mockResolvedValue("abc123def456abc123def456abc123def456abc123"); // fresh clone revparse
        mockClone = vi.fn().mockResolvedValue(undefined);
        mockRaw = vi.fn().mockResolvedValue("");
        mockCheckout = vi.fn().mockResolvedValue(undefined);

        const mockGit = {
            checkIsRepo: mockCheckIsRepo,
            pull: mockPull,
            revparse: mockRevparse,
            clone: mockClone,
            raw: mockRaw,
            checkout: mockCheckout,
        } as unknown as SimpleGit;

        vi.mocked(gitUtils.createGit).mockReturnValue(mockGit);
        vi.mocked(gitUtils.createInteractiveGit).mockReturnValue(mockGit);
        vi.mocked(gitUtils.isAuthError).mockReturnValue(false);
        mockRm.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("falls through to fresh clone when cache-hit git operation fails with ENOENT", async () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        const result = await cloneGitSource({
            url: "https://example.com/enoent-cache.git",
            useCache: true,
        });

        // Should warn about unusable cache
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Cached repository unusable"));
        // Should recover via fresh clone
        expect(result.fromCache).toBe(false);
        expect(result.sha).toBeDefined();
        expect(mockClone).toHaveBeenCalled();

        warnSpy.mockRestore();
    });

    it("still throws GitAuthenticationError on auth failure in cache-hit path", async () => {
        mockCheckIsRepo.mockReset();
        mockCheckIsRepo.mockResolvedValueOnce(true);

        mockRevparse.mockReset();
        mockRevparse.mockRejectedValueOnce(new Error("terminal prompts disabled"));
        vi.mocked(gitUtils.isAuthError).mockReturnValue(true);

        await expect(
            cloneGitSource({
                url: "https://example.com/private-repo.git",
                useCache: true,
            }),
        ).rejects.toThrow(GitAuthenticationError);
    });
});

describe("concurrent clone serialization", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("serializes concurrent clones to the same cache path", async () => {
        let cloneResolve!: () => void;
        const delayedClone = new Promise<void>((resolve) => {
            cloneResolve = resolve;
        });

        const mockClone = vi.fn().mockImplementationOnce(() => delayedClone);
        const mockFetch = vi.fn().mockResolvedValue(undefined);
        const mockRaw = vi.fn().mockResolvedValue("");
        const mockRevparse = vi
            .fn()
            .mockResolvedValue("abc123def456abc123def456abc123def456abc123");
        const mockCheckout = vi.fn().mockResolvedValue(undefined);
        const mockPull = vi.fn().mockResolvedValue(undefined);
        const mockCheckIsRepo = vi
            .fn()
            .mockRejectedValueOnce(new Error("not a git repo")) // call 1: no cache
            .mockResolvedValue(true); // call 2 onwards: cache populated by call 1

        const mockGit = {
            checkIsRepo: mockCheckIsRepo,
            clone: mockClone,
            fetch: mockFetch,
            raw: mockRaw,
            revparse: mockRevparse,
            checkout: mockCheckout,
            pull: mockPull,
        } as unknown as SimpleGit;

        vi.mocked(gitUtils.createGit).mockReturnValue(mockGit);
        vi.mocked(gitUtils.createInteractiveGit).mockReturnValue(mockGit);

        // Start both calls concurrently — same URL, different subpaths
        const call1 = cloneGitSource({
            url: "https://example.com/concurrent.git",
            useCache: false,
        });
        const call2 = cloneGitSource({
            url: "https://example.com/concurrent.git",
            useCache: false,
            subpath: "profiles/other",
        });

        // Let the first clone complete
        cloneResolve();

        const [result1, result2] = await Promise.all([call1, call2]);

        // Both should succeed and share the same cache path
        expect(result1.cachePath).toBe(result2.cachePath);
        // Only one git.clone call — second call reused cache via fetch+reset
        expect(mockClone).toHaveBeenCalledTimes(1);
    });
});
