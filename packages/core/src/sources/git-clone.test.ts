import { homedir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { GitSourceError } from "../errors.js";
import { cloneGitSource, invalidateCache } from "./git-clone.js";

// These tests are covered by git-integration.test.ts which handles concurrent access better
// Skipping to avoid race conditions with parallel test execution
describe.skip("cloneGitSource", () => {
  const testUrl = "https://github.com/anthropics/courses.git";

  beforeEach(async () => {
    // Clean up cache before each test to ensure fresh state
    await invalidateCache(testUrl);
    await invalidateCache(testUrl, "main");
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
    await invalidateCache(testUrl);

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
    await invalidateCache(testUrl);
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
