import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GitSourceError } from "../errors.js";
import { parseSource } from "../utils/source-parser.js";
import * as gitClone from "./git-clone.js";
import { resolveGitHubSource } from "./github-resolver.js";

describe("GitHub Resolver", () => {
  const originalEnv = process.env.GITHUB_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_TOKEN = undefined;
  });

  afterEach(() => {
    // Restore original GITHUB_TOKEN
    if (originalEnv !== undefined) {
      process.env.GITHUB_TOKEN = originalEnv;
    } else {
      process.env.GITHUB_TOKEN = undefined;
    }
  });

  describe("resolveGitHubSource", () => {
    it("should resolve GitHub source without token", async () => {
      const source = parseSource("github:baton/example-profile");
      if (source.provider !== "github") throw new Error("Expected GitHub source");

      const cloneSpy = vi.spyOn(gitClone, "cloneGitSource").mockResolvedValue({
        localPath: "/cache/abc123",
        fromCache: false,
        sha: "abc123def456",
      });

      const result = await resolveGitHubSource({ source });

      expect(result).toEqual({
        localPath: "/cache/abc123",
        fromCache: false,
        sha: "abc123def456",
      });

      expect(cloneSpy).toHaveBeenCalledWith({
        url: "https://github.com/baton/example-profile.git",
        ref: undefined,
        subpath: undefined,
        useCache: true,
      });
    });

    it("should resolve GitHub source with authentication token", async () => {
      process.env.GITHUB_TOKEN = "ghp_test_token_123";

      const source = parseSource("github:baton/private-repo");
      if (source.provider !== "github") throw new Error("Expected GitHub source");

      const cloneSpy = vi.spyOn(gitClone, "cloneGitSource").mockResolvedValue({
        localPath: "/cache/xyz789",
        fromCache: false,
        sha: "xyz789abc123",
      });

      const result = await resolveGitHubSource({ source });

      expect(result).toEqual({
        localPath: "/cache/xyz789",
        fromCache: false,
        sha: "xyz789abc123",
      });

      // Verify URL was enhanced with token
      expect(cloneSpy).toHaveBeenCalledWith({
        url: "https://ghp_test_token_123@github.com/baton/private-repo.git",
        ref: undefined,
        subpath: undefined,
        useCache: true,
      });
    });

    it("should resolve GitHub source with branch ref", async () => {
      const source = parseSource("github:baton/example@v2.0");
      if (source.provider !== "github") throw new Error("Expected GitHub source");

      const cloneSpy = vi.spyOn(gitClone, "cloneGitSource").mockResolvedValue({
        localPath: "/cache/def456",
        fromCache: true,
        sha: "def456ghi789",
      });

      const result = await resolveGitHubSource({ source });

      expect(result).toEqual({
        localPath: "/cache/def456",
        fromCache: true,
        sha: "def456ghi789",
      });

      expect(cloneSpy).toHaveBeenCalledWith({
        url: "https://github.com/baton/example.git",
        ref: "v2.0",
        subpath: undefined,
        useCache: true,
      });
    });

    it("should resolve GitHub source with subpath", async () => {
      const source = parseSource("github:baton/monorepo/frontend");
      if (source.provider !== "github") throw new Error("Expected GitHub source");

      const cloneSpy = vi.spyOn(gitClone, "cloneGitSource").mockResolvedValue({
        localPath: "/cache/ghi789/frontend",
        fromCache: false,
        sha: "ghi789jkl012",
      });

      const result = await resolveGitHubSource({ source });

      expect(result).toEqual({
        localPath: "/cache/ghi789/frontend",
        fromCache: false,
        sha: "ghi789jkl012",
      });

      expect(cloneSpy).toHaveBeenCalledWith({
        url: "https://github.com/baton/monorepo.git",
        ref: undefined,
        subpath: "frontend",
        useCache: true,
      });
    });

    it("should disable cache when useCache is false", async () => {
      const source = parseSource("github:baton/example");
      if (source.provider !== "github") throw new Error("Expected GitHub source");

      const cloneSpy = vi.spyOn(gitClone, "cloneGitSource").mockResolvedValue({
        localPath: "/tmp/fresh-clone",
        fromCache: false,
        sha: "fresh123abc",
      });

      await resolveGitHubSource({ source, useCache: false });

      expect(cloneSpy).toHaveBeenCalledWith({
        url: "https://github.com/baton/example.git",
        ref: undefined,
        subpath: undefined,
        useCache: false,
      });
    });

    it("should throw enhanced error for authentication failure", async () => {
      const source = parseSource("github:baton/private-repo");
      if (source.provider !== "github") throw new Error("Expected GitHub source");

      vi.spyOn(gitClone, "cloneGitSource").mockRejectedValue(
        new Error("Authentication failed for 'https://github.com/baton/private-repo.git'"),
      );

      await expect(resolveGitHubSource({ source })).rejects.toThrow(
        /GitHub authentication failed.*Set GITHUB_TOKEN/,
      );
    });

    it("should throw enhanced error for repository not found", async () => {
      const source = parseSource("github:baton/nonexistent");
      if (source.provider !== "github") throw new Error("Expected GitHub source");

      vi.spyOn(gitClone, "cloneGitSource").mockRejectedValue(
        new Error("Repository not found: 404"),
      );

      await expect(resolveGitHubSource({ source })).rejects.toThrow(
        /GitHub repository not found.*baton\/nonexistent/,
      );
    });

    it("should throw enhanced error for permission denied", async () => {
      const source = parseSource("github:baton/forbidden-repo");
      if (source.provider !== "github") throw new Error("Expected GitHub source");

      vi.spyOn(gitClone, "cloneGitSource").mockRejectedValue(
        new Error("Permission denied: 403 Forbidden"),
      );

      await expect(resolveGitHubSource({ source })).rejects.toThrow(
        /Permission denied.*Verify your access rights/,
      );
    });

    it("should throw enhanced error for network errors", async () => {
      const source = parseSource("github:baton/example");
      if (source.provider !== "github") throw new Error("Expected GitHub source");

      vi.spyOn(gitClone, "cloneGitSource").mockRejectedValue(
        new Error("getaddrinfo ENOTFOUND github.com"),
      );

      await expect(resolveGitHubSource({ source })).rejects.toThrow(
        /Network error.*Check your internet connection/,
      );
    });

    it("should re-throw original error if no specific error case matches", async () => {
      const source = parseSource("github:baton/example");
      if (source.provider !== "github") throw new Error("Expected GitHub source");

      const customError = new GitSourceError("Some unexpected error");
      vi.spyOn(gitClone, "cloneGitSource").mockRejectedValue(customError);

      await expect(resolveGitHubSource({ source })).rejects.toThrow("Some unexpected error");
    });
  });

  describe("GitHub Token Authentication", () => {
    it("should enhance URL with GITHUB_TOKEN when available", async () => {
      process.env.GITHUB_TOKEN = "ghp_secret_token";

      const source = parseSource("github:org/repo");
      if (source.provider !== "github") throw new Error("Expected GitHub source");

      const cloneSpy = vi.spyOn(gitClone, "cloneGitSource").mockResolvedValue({
        localPath: "/cache/test",
        fromCache: false,
        sha: "test123",
      });

      await resolveGitHubSource({ source });

      expect(cloneSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://ghp_secret_token@github.com/org/repo.git",
        }),
      );
    });

    it("should not modify URL when GITHUB_TOKEN is not set", async () => {
      const source = parseSource("github:org/repo");
      if (source.provider !== "github") throw new Error("Expected GitHub source");

      const cloneSpy = vi.spyOn(gitClone, "cloneGitSource").mockResolvedValue({
        localPath: "/cache/test",
        fromCache: false,
        sha: "test123",
      });

      await resolveGitHubSource({ source });

      expect(cloneSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://github.com/org/repo.git",
        }),
      );
    });
  });
});
