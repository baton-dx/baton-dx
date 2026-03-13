import { beforeEach, describe, expect, it, vi } from "vitest";
import * as profileChain from "../inheritance/profile-chain.js";
import * as utils from "../utils/index.js";
import { parseSource } from "../utils/index.js";
import {
    type BatchResolveOptions,
    checkRemoteSha,
    getPackageNameFromSource,
    pLimit,
    resolveSourcesBatch,
} from "./batch-resolver.js";
import * as gitClone from "./git-clone.js";
import * as gitUtils from "./git-utils.js";
import * as sourceDiscovery from "./source-discovery.js";
import * as versionResolver from "./version-resolver.js";

vi.mock("./git-utils.js", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./git-utils.js")>()),
    createGit: vi.fn(),
    withTokenAuth: vi.fn(),
}));
vi.mock("./git-clone.js", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./git-clone.js")>()),
    cloneGitSource: vi.fn(),
}));
vi.mock("./npm-resolver.js", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./npm-resolver.js")>()),
    resolveNpmSource: vi.fn(),
}));
vi.mock("./version-resolver.js", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./version-resolver.js")>()),
    resolveVersion: vi.fn(),
}));
vi.mock("../inheritance/profile-chain.js", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../inheritance/profile-chain.js")>()),
    resolveProfileChain: vi.fn(),
}));

describe("pLimit", () => {
    it("limits concurrency to the specified value", async () => {
        const limit = pLimit(2);
        let running = 0;
        let maxRunning = 0;

        const task = () =>
            limit(async () => {
                running++;
                maxRunning = Math.max(maxRunning, running);
                await new Promise((r) => setTimeout(r, 50));
                running--;
            });

        await Promise.all([task(), task(), task(), task(), task()]);

        expect(maxRunning).toBe(2);
    });

    it("returns the value from the wrapped function", async () => {
        const limit = pLimit(1);
        const result = await limit(() => Promise.resolve(42));
        expect(result).toBe(42);
    });

    it("propagates errors from the wrapped function", async () => {
        const limit = pLimit(1);
        await expect(limit(() => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    });
});

describe("getPackageNameFromSource", () => {
    it("returns org/repo for github sources", () => {
        const parsed = parseSource("github:my-org/my-repo/profiles/main");
        expect(getPackageNameFromSource("github:my-org/my-repo/profiles/main", parsed)).toBe(
            "my-org/my-repo",
        );
    });

    it("returns scoped package name for npm sources", () => {
        const parsed = parseSource("npm:@scope/pkg");
        expect(getPackageNameFromSource("npm:@scope/pkg", parsed)).toBe("@scope/pkg");
    });

    it("returns unscoped package name for npm sources", () => {
        const parsed = parseSource("npm:my-pkg/profiles/base");
        expect(getPackageNameFromSource("npm:my-pkg/profiles/base", parsed)).toBe("my-pkg");
    });

    it("returns url for git sources", () => {
        const parsed = parseSource("https://example.com/repo.git");
        expect(getPackageNameFromSource("https://example.com/repo.git", parsed)).toBe(
            "https://example.com/repo.git",
        );
    });

    it("returns raw source for local sources", () => {
        const parsed = parseSource("./profiles/base");
        expect(getPackageNameFromSource("./profiles/base", parsed)).toBe("./profiles/base");
    });
});

describe("checkRemoteSha", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns ok with changed=false when lockfile SHA found in remote refs", async () => {
        const mockGit = {
            listRemote: vi
                .fn()
                .mockResolvedValue(
                    "abc123def456abc123def456abc123def456abc1\trefs/heads/main\n" +
                        "def789abc123def789abc123def789abc123def7\trefs/tags/v1.0.0\n",
                ),
        };
        vi.mocked(gitUtils.createGit).mockReturnValue(
            mockGit as unknown as ReturnType<typeof gitUtils.createGit>,
        );

        const result = await checkRemoteSha(
            "https://github.com/org/repo.git",
            "abc123def456abc123def456abc123def456abc1",
        );

        expect(result).toEqual({ type: "ok", changed: false });
    });

    it("returns ok with changed=true when lockfile SHA not in remote refs", async () => {
        const mockGit = {
            listRemote: vi
                .fn()
                .mockResolvedValue("abc123def456abc123def456abc123def456abc1\trefs/heads/main\n"),
        };
        vi.mocked(gitUtils.createGit).mockReturnValue(
            mockGit as unknown as ReturnType<typeof gitUtils.createGit>,
        );

        const result = await checkRemoteSha(
            "https://github.com/org/repo.git",
            "000000000000000000000000000000000000dead",
        );

        expect(result).toEqual({ type: "ok", changed: true });
    });

    it("returns auth_error on authentication failure", async () => {
        const mockGit = {
            listRemote: vi.fn().mockRejectedValue(new Error("terminal prompts disabled")),
        };
        vi.mocked(gitUtils.createGit).mockReturnValue(
            mockGit as unknown as ReturnType<typeof gitUtils.createGit>,
        );

        const result = await checkRemoteSha(
            "https://github.com/org/private-repo.git",
            "abc123def456abc123def456abc123def456abc1",
        );

        expect(result.type).toBe("auth_error");
    });

    it("returns network_error on network failure", async () => {
        const mockGit = {
            listRemote: vi.fn().mockRejectedValue(new Error("Could not resolve host")),
        };
        vi.mocked(gitUtils.createGit).mockReturnValue(
            mockGit as unknown as ReturnType<typeof gitUtils.createGit>,
        );

        const result = await checkRemoteSha(
            "https://github.com/org/repo.git",
            "abc123def456abc123def456abc123def456abc1",
        );

        expect(result).toEqual({ type: "network_error" });
    });

    it("uses token auth when provided", async () => {
        const mockGit = {
            listRemote: vi.fn().mockResolvedValue("abc1\trefs/heads/main\n"),
        };
        const authedGit = { ...mockGit };
        vi.mocked(gitUtils.createGit).mockReturnValue(
            mockGit as unknown as ReturnType<typeof gitUtils.createGit>,
        );
        vi.mocked(gitUtils.withTokenAuth).mockReturnValue(
            authedGit as unknown as ReturnType<typeof gitUtils.withTokenAuth>,
        );

        await checkRemoteSha("https://github.com/org/repo.git", "abc1", "my-token");

        expect(gitUtils.withTokenAuth).toHaveBeenCalledWith(
            mockGit,
            "https://github.com/org/repo.git",
            "my-token",
        );
    });
});

describe("resolveSourcesBatch", () => {
    const baseOptions: BatchResolveOptions = {
        mode: "sync",
        concurrency: 5,
        projectRoot: "/project",
        currentVersion: "1.0.0",
        resolveAuth: vi.fn().mockResolvedValue({ method: "token", token: "t" }),
        getAuthenticatedUrl: vi.fn().mockImplementation((url: string) => Promise.resolve(url)),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Default: loadProfileManifest returns a minimal manifest
        vi.spyOn(utils, "loadProfileManifest").mockResolvedValue({
            name: "test",
            version: "1.0.0",
        } as ReturnType<typeof utils.loadProfileManifest> extends Promise<infer T> ? T : never);
        // Default: resolveProfileChain returns single profile
        vi.mocked(profileChain.resolveProfileChain).mockResolvedValue([
            {
                manifest: { name: "test", version: "1.0.0" } as Parameters<
                    typeof profileChain.resolveProfileChain
                >[0],
                source: "test",
                name: "test",
            },
        ]);
        // Default: no source manifest
        vi.spyOn(sourceDiscovery, "findSourceManifest").mockRejectedValue(new Error("not found"));
    });

    it("resolves local sources without pLimit", async () => {
        const result = await resolveSourcesBatch([{ source: "./profiles/base" }], baseOptions);

        expect(result.resolved).toHaveLength(1);
        expect(result.stats.local).toBe(1);
        expect(result.errors).toHaveLength(0);
    });

    it("resolves git sources in parallel via pLimit", async () => {
        vi.mocked(gitClone.cloneGitSource).mockResolvedValue({
            localPath: "/cache/abc",
            fromCache: false,
            sha: "abc123",
            cachePath: "/cache/abc",
            sparseCheckout: false,
        });
        vi.mocked(versionResolver.resolveVersion).mockResolvedValue("abc123");

        const result = await resolveSourcesBatch(
            [
                { source: "github:org/repo-a/profiles/main" },
                { source: "github:org/repo-b/profiles/main" },
            ],
            baseOptions,
        );

        expect(result.resolved).toHaveLength(2);
        expect(result.stats.cloned).toBe(2);
    });

    it("sync mode: uses cache when lockfile SHA matches remote", async () => {
        const mockGit = {
            listRemote: vi
                .fn()
                .mockResolvedValue("aaa111aaa111aaa111aaa111aaa111aaa111aaa1\trefs/heads/main\n"),
        };
        vi.mocked(gitUtils.createGit).mockReturnValue(
            mockGit as unknown as ReturnType<typeof gitUtils.createGit>,
        );
        vi.mocked(gitUtils.withTokenAuth).mockReturnValue(
            mockGit as unknown as ReturnType<typeof gitUtils.withTokenAuth>,
        );

        vi.mocked(gitClone.cloneGitSource).mockResolvedValue({
            localPath: "/cache/abc",
            fromCache: true,
            sha: "aaa111aaa111aaa111aaa111aaa111aaa111aaa1",
            cachePath: "/cache/abc",
            sparseCheckout: false,
        });

        const result = await resolveSourcesBatch([{ source: "github:org/repo/profiles/main" }], {
            ...baseOptions,
            lockfile: {
                locked_at: "2026-01-01T00:00:00.000Z",
                packages: {
                    "org/repo": {
                        source: "github:org/repo/profiles/main",
                        resolved: "https://github.com/org/repo.git",
                        version: "main",
                        sha: "aaa111aaa111aaa111aaa111aaa111aaa111aaa1",
                        integrity: {},
                    },
                },
            },
        });

        expect(result.stats.cached).toBe(1);
        expect(vi.mocked(gitClone.cloneGitSource)).toHaveBeenCalledWith(
            expect.objectContaining({ useCache: true }),
        );
    });

    it("sync mode: fresh clone when lockfile SHA not in remote refs", async () => {
        const mockGit = {
            listRemote: vi
                .fn()
                .mockResolvedValue("bbb222bbb222bbb222bbb222bbb222bbb222bbb2\trefs/heads/main\n"),
        };
        vi.mocked(gitUtils.createGit).mockReturnValue(
            mockGit as unknown as ReturnType<typeof gitUtils.createGit>,
        );
        vi.mocked(gitUtils.withTokenAuth).mockReturnValue(
            mockGit as unknown as ReturnType<typeof gitUtils.withTokenAuth>,
        );
        vi.mocked(versionResolver.resolveVersion).mockResolvedValue(
            "bbb222bbb222bbb222bbb222bbb222bbb222bbb2",
        );
        vi.mocked(gitClone.cloneGitSource).mockResolvedValue({
            localPath: "/cache/abc",
            fromCache: false,
            sha: "bbb222bbb222bbb222bbb222bbb222bbb222bbb2",
            cachePath: "/cache/abc",
            sparseCheckout: false,
        });

        const result = await resolveSourcesBatch([{ source: "github:org/repo/profiles/main" }], {
            ...baseOptions,
            lockfile: {
                locked_at: "2026-01-01T00:00:00.000Z",
                packages: {
                    "org/repo": {
                        source: "github:org/repo/profiles/main",
                        resolved: "https://github.com/org/repo.git",
                        version: "main",
                        sha: "old-sha-not-in-remote",
                        integrity: {},
                    },
                },
            },
        });

        expect(result.stats.cloned).toBe(1);
        expect(vi.mocked(gitClone.cloneGitSource)).toHaveBeenCalledWith(
            expect.objectContaining({ useCache: false }),
        );
    });

    it("sync mode: fresh clone when checkRemoteSha fails (network error)", async () => {
        const mockGit = {
            listRemote: vi.fn().mockRejectedValue(new Error("Could not resolve host")),
        };
        vi.mocked(gitUtils.createGit).mockReturnValue(
            mockGit as unknown as ReturnType<typeof gitUtils.createGit>,
        );
        vi.mocked(gitUtils.withTokenAuth).mockReturnValue(
            mockGit as unknown as ReturnType<typeof gitUtils.withTokenAuth>,
        );
        vi.mocked(versionResolver.resolveVersion).mockResolvedValue("abc123");
        vi.mocked(gitClone.cloneGitSource).mockResolvedValue({
            localPath: "/cache/abc",
            fromCache: false,
            sha: "abc123",
            cachePath: "/cache/abc",
            sparseCheckout: false,
        });

        const result = await resolveSourcesBatch([{ source: "github:org/repo/profiles/main" }], {
            ...baseOptions,
            lockfile: {
                locked_at: "2026-01-01T00:00:00.000Z",
                packages: {
                    "org/repo": {
                        source: "github:org/repo/profiles/main",
                        resolved: "https://github.com/org/repo.git",
                        version: "main",
                        sha: "old-sha",
                        integrity: {},
                    },
                },
            },
        });

        expect(result.stats.cloned).toBe(1);
        expect(vi.mocked(gitClone.cloneGitSource)).toHaveBeenCalledWith(
            expect.objectContaining({ useCache: false }),
        );
    });

    it("apply mode: always uses lockfile SHA with cache", async () => {
        vi.mocked(gitClone.cloneGitSource).mockResolvedValue({
            localPath: "/cache/abc",
            fromCache: true,
            sha: "locked-sha-123",
            cachePath: "/cache/abc",
            sparseCheckout: false,
        });

        const result = await resolveSourcesBatch([{ source: "github:org/repo/profiles/main" }], {
            ...baseOptions,
            mode: "apply",
            lockfile: {
                locked_at: "2026-01-01T00:00:00.000Z",
                packages: {
                    "org/repo": {
                        source: "github:org/repo/profiles/main",
                        resolved: "https://github.com/org/repo.git",
                        version: "main",
                        sha: "locked-sha-123",
                        integrity: {},
                    },
                },
            },
        });

        expect(result.stats.cached).toBe(1);
        expect(vi.mocked(gitClone.cloneGitSource)).toHaveBeenCalledWith(
            expect.objectContaining({
                ref: "locked-sha-123",
                useCache: true,
            }),
        );
    });

    it("collects errors without aborting other sources", async () => {
        vi.mocked(versionResolver.resolveVersion).mockResolvedValue("abc123");
        vi.mocked(gitClone.cloneGitSource)
            .mockResolvedValueOnce({
                localPath: "/cache/abc",
                fromCache: false,
                sha: "abc123",
                cachePath: "/cache/abc",
                sparseCheckout: false,
            })
            .mockRejectedValueOnce(new Error("clone failed"));

        const result = await resolveSourcesBatch(
            [
                { source: "github:org/repo-ok/profiles/main" },
                { source: "github:org/repo-fail/profiles/main" },
            ],
            baseOptions,
        );

        expect(result.resolved).toHaveLength(1);
        expect(result.errors).toHaveLength(1);
        expect(result.stats.failed).toBe(1);
    });

    it("deduplicates resolveAuth calls per hostname", async () => {
        vi.mocked(versionResolver.resolveVersion).mockResolvedValue("abc123");
        vi.mocked(gitClone.cloneGitSource).mockResolvedValue({
            localPath: "/cache/abc",
            fromCache: false,
            sha: "abc123",
            cachePath: "/cache/abc",
            sparseCheckout: false,
        });

        await resolveSourcesBatch(
            [
                { source: "github:org/repo-a/profiles/main" },
                { source: "github:org/repo-b/profiles/main" },
            ],
            baseOptions,
        );

        // Both sources are on github.com — resolveAuth should be called once
        expect(baseOptions.resolveAuth).toHaveBeenCalledTimes(1);
    });
});
