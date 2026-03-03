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
});
