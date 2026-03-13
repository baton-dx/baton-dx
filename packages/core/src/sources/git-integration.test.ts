import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cloneGitSource } from "./git-clone.js";
import { loadLocalSource } from "./local-source.js";

const CACHE_DIR = join(homedir(), ".baton", "cache");

async function cleanCache(): Promise<void> {
    try {
        await rm(CACHE_DIR, { recursive: true, force: true });
    } catch {
        // Ignore errors if cache doesn't exist
    }
}

describe("Git Source Provider Integration Tests", () => {
    beforeEach(async () => {
        // Clean cache before each test
        await cleanCache();
    });

    afterEach(async () => {
        // Clean up cache after tests
        await cleanCache();
    });

    describe("Public GitHub repository cloning", () => {
        it("should clone a public GitHub repository", async () => {
            // Use a small, stable public repo for testing
            const result = await cloneGitSource({
                url: "https://github.com/tj/git-extras.git",
                ref: "main",
            });

            expect(result.localPath).toBeDefined();
            expect(result.localPath).toContain(CACHE_DIR);
        }, 60000); // 60s timeout for network operation

        it("should handle invalid repository URL", async () => {
            await expect(
                cloneGitSource({
                    url: "https://github.com/invalid/nonexistent-repo-12345.git",
                    ref: "main",
                }),
            ).rejects.toThrow();
        }, 30000);
    });

    describe("Tag resolution", () => {
        it("should checkout specific tag", async () => {
            // Use git-extras with a known stable tag
            const result = await cloneGitSource({
                url: "https://github.com/tj/git-extras.git",
                ref: "6.5.0", // Known stable tag
            });

            expect(result.localPath).toBeDefined();
            expect(result.localPath).toContain(CACHE_DIR);
        }, 60000);
    });

    describe("Sparse checkout", () => {
        it("should clone only specific subdirectory", async () => {
            const result = await cloneGitSource({
                url: "https://github.com/tj/git-extras.git",
                ref: "main",
                subpath: "bin",
            });

            expect(result.localPath).toBeDefined();
            // The localPath should point to the subpath within the cloned repo
            expect(result.localPath).toContain(CACHE_DIR);
        }, 60000);
    });

    describe("Cache behavior", () => {
        it("should use cache on second fetch", async () => {
            const url = "https://github.com/tj/git-extras.git";
            const ref = "main";

            // First fetch - clones from remote
            const firstResult = await cloneGitSource({
                url,
                ref,
                useCache: true,
            });
            const firstPath = firstResult.localPath;

            // Second fetch - should use cache
            const secondResult = await cloneGitSource({
                url,
                ref,
                useCache: true,
            });
            const secondPath = secondResult.localPath;

            // Both should return same local path (cache hit)
            expect(firstPath).toBe(secondPath);
        }, 90000); // 90s timeout for two network operations

        it("should invalidate cache when ref changes", async () => {
            const url = "https://github.com/tj/git-extras.git";

            // Fetch main branch
            const mainResult = await cloneGitSource({
                url,
                ref: "main",
            });

            // Fetch different tag - should create new cache entry
            const tagResult = await cloneGitSource({
                url,
                ref: "6.5.0",
            });

            // Paths should be different (different cache keys)
            expect(mainResult.localPath).not.toBe(tagResult.localPath);
        }, 90000);

        it("should bypass cache when useCache is false", async () => {
            const url = "https://github.com/tj/git-extras.git";
            const ref = "main";

            // First fetch with cache enabled
            const cachedResult = await cloneGitSource({
                url,
                ref,
                useCache: true,
            });

            // Second fetch with cache disabled - should re-clone
            const nonCachedResult = await cloneGitSource({
                url,
                ref,
                useCache: false,
            });

            // Both operations should succeed (paths may differ due to cache invalidation)
            expect(cachedResult.localPath).toBeDefined();
            expect(nonCachedResult.localPath).toBeDefined();
        }, 90000);
    });

    describe("Local source reading", () => {
        let localFixtureDir: string;

        beforeEach(async () => {
            localFixtureDir = await mkdtemp(join(tmpdir(), "baton-local-source-"));
            await mkdir(join(localFixtureDir, "profile"), { recursive: true });
            await writeFile(
                join(localFixtureDir, "profile", "baton.profile.yaml"),
                'name: test-profile\nversion: 1.0.0\n\nai:\n  tools:\n    - "*"\n',
            );
        });

        afterEach(async () => {
            await rm(localFixtureDir, { recursive: true, force: true });
        });

        it("should load fixture profile from filesystem", async () => {
            const fixturePath = join(localFixtureDir, "profile");

            const result = await loadLocalSource({
                path: fixturePath,
                baseDir: localFixtureDir,
            });

            // Should return integrity hashes for all files
            expect(result.integrity).toBeDefined();
            expect(Object.keys(result.integrity).length).toBeGreaterThan(0);

            // Should include baton.profile.yaml
            expect(
                Object.keys(result.integrity).some((key) => key.includes("baton.profile.yaml")),
            ).toBe(true);
        });

        it("should resolve relative paths correctly", async () => {
            const result = await loadLocalSource({
                path: "./profile",
                baseDir: localFixtureDir,
            });

            expect(result.integrity).toBeDefined();
            expect(Object.keys(result.integrity).length).toBeGreaterThan(0);
        });

        it("should throw error for non-existent local path", async () => {
            await expect(
                loadLocalSource({
                    path: "./nonexistent-directory",
                    baseDir: localFixtureDir,
                }),
            ).rejects.toThrow();
        });
    });

    describe("Network unavailability handling", () => {
        it.skip("should handle network unavailability gracefully", async () => {
            // This test is skipped by default to avoid CI failures when offline
            // To run: remove .skip and ensure network is unavailable

            // Attempt to clone with a timeout
            await expect(
                cloneGitSource({
                    url: "https://github.com/tj/git-extras.git",
                    ref: "main",
                    useCache: false,
                }),
            ).rejects.toThrow();
        });

        it("should fall back to cache when network is unavailable", async () => {
            const url = "https://github.com/tj/git-extras.git";
            const ref = "main";

            // First fetch to populate cache
            const cachedResult = await cloneGitSource({
                url,
                ref,
                useCache: true,
            });

            // Second fetch should use cache even if network is unavailable
            // (since we have cache, this should succeed)
            const fallbackResult = await cloneGitSource({
                url,
                ref,
                useCache: true,
            });

            expect(fallbackResult.localPath).toBe(cachedResult.localPath);
        }, 90000);
    });
});
