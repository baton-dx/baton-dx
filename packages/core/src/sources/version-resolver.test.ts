import type { SimpleGit } from "simple-git";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GitAuthenticationError, VersionNotFoundError } from "../errors.js";
import * as gitUtils from "./git-utils.js";
import { resolveVersion } from "./version-resolver.js";

// Mock git-utils
vi.mock("./git-utils.js");

describe("resolveVersion", () => {
    let mockListRemote: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockListRemote = vi.fn();
        const mockGit = {
            listRemote: mockListRemote,
        } as unknown as SimpleGit;

        vi.mocked(gitUtils.createGit).mockReturnValue(mockGit);
        vi.mocked(gitUtils.createInteractiveGit).mockReturnValue(mockGit);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("latest", () => {
        it("should resolve 'latest' to the newest semver tag", async () => {
            mockListRemote.mockResolvedValueOnce(
                `
abc1234567890def1234567890abcdef12345678 refs/tags/v1.0.0
def1234567890abc1234567890def12345678abcd refs/tags/v2.0.0
123abc4567890def1234567890abc12345678def refs/tags/v1.5.0
      `.trim(),
            );

            // Second call for getTagSha
            mockListRemote.mockResolvedValueOnce(
                "def1234567890abc1234567890def12345678abcd refs/tags/v2.0.0",
            );

            const result = await resolveVersion("https://github.com/org/repo.git");
            expect(result).toBe("def1234567890abc1234567890def12345678abcd");
        });

        it("should resolve 'latest' to HEAD when no semver tags exist", async () => {
            mockListRemote.mockResolvedValueOnce(
                `
abc1234567890def1234567890abcdef12345678 refs/heads/main
def1234567890abc1234567890def12345678abcd refs/heads/develop
      `.trim(),
            );

            const result = await resolveVersion("https://github.com/org/repo.git");
            expect(result).toBe("abc1234567890def1234567890abcdef12345678");
        });

        it("should fall back to master branch if main doesn't exist", async () => {
            mockListRemote.mockResolvedValueOnce(
                `
abc1234567890def1234567890abcdef12345678 refs/heads/master
def1234567890abc1234567890def12345678abcd refs/heads/develop
      `.trim(),
            );

            const result = await resolveVersion("https://github.com/org/repo.git");
            expect(result).toBe("abc1234567890def1234567890abcdef12345678");
        });

        it("should throw VersionNotFoundError when no refs exist", async () => {
            mockListRemote.mockResolvedValueOnce("");

            await expect(resolveVersion("https://github.com/org/repo.git")).rejects.toThrow(
                VersionNotFoundError,
            );
        });
    });

    describe("exact tags", () => {
        it("should resolve exact tag with v prefix", async () => {
            mockListRemote.mockResolvedValueOnce(
                `
abc1234567890def1234567890abcdef12345678 refs/tags/v1.0.0
def1234567890abc1234567890def12345678abcd refs/tags/v2.0.0
      `.trim(),
            );

            mockListRemote.mockResolvedValueOnce(
                "def1234567890abc1234567890def12345678abcd refs/tags/v2.0.0",
            );

            const result = await resolveVersion("https://github.com/org/repo.git", "v2.0.0");
            expect(result).toBe("def1234567890abc1234567890def12345678abcd");
        });

        it("should resolve exact tag without v prefix", async () => {
            mockListRemote.mockResolvedValueOnce(
                `
abc1234567890def1234567890abcdef12345678 refs/tags/v1.0.0
def1234567890abc1234567890def12345678abcd refs/tags/v2.0.0
      `.trim(),
            );

            mockListRemote.mockResolvedValueOnce(
                "def1234567890abc1234567890def12345678abcd refs/tags/v2.0.0",
            );

            const result = await resolveVersion("https://github.com/org/repo.git", "2.0.0");
            expect(result).toBe("def1234567890abc1234567890def12345678abcd");
        });
    });

    describe("branch names", () => {
        it("should resolve to branch HEAD commit", async () => {
            mockListRemote.mockResolvedValueOnce(
                `
abc1234567890def1234567890abcdef12345678 refs/heads/main
def1234567890abc1234567890def12345678abcd refs/heads/develop
123abc4567890def1234567890abc12345678def refs/heads/feature/new
      `.trim(),
            );

            const result = await resolveVersion("https://github.com/org/repo.git", "develop");
            expect(result).toBe("def1234567890abc1234567890def12345678abcd");
        });

        it("should resolve feature branch", async () => {
            mockListRemote.mockResolvedValueOnce(
                `
abc1234567890def1234567890abcdef12345678 refs/heads/main
def1234567890abc1234567890def12345678abcd refs/heads/feature/new-feature
      `.trim(),
            );

            const result = await resolveVersion(
                "https://github.com/org/repo.git",
                "feature/new-feature",
            );
            expect(result).toBe("def1234567890abc1234567890def12345678abcd");
        });
    });

    describe("commit SHAs", () => {
        it("should accept full commit SHA", async () => {
            mockListRemote.mockResolvedValueOnce("");

            const sha = "abc1234567890def1234567890abcdef12345678";
            const result = await resolveVersion("https://github.com/org/repo.git", sha);
            expect(result).toBe(sha);
        });

        it("should accept short commit SHA (7 chars)", async () => {
            mockListRemote.mockResolvedValueOnce("");

            const shortSha = "abc1234";
            const result = await resolveVersion("https://github.com/org/repo.git", shortSha);
            expect(result).toBe(shortSha);
        });

        it("should accept commit SHA of any length 7-40", async () => {
            mockListRemote.mockResolvedValueOnce("");

            const sha = "abc1234567890def";
            const result = await resolveVersion("https://github.com/org/repo.git", sha);
            expect(result).toBe(sha);
        });
    });

    describe("semver ranges", () => {
        beforeEach(() => {
            mockListRemote.mockResolvedValueOnce(
                `
abc1234567890def1234567890abcdef12345678 refs/tags/v1.0.0
def1234567890abc1234567890def12345678abcd refs/tags/v1.2.3
123abc4567890def1234567890abc12345678def refs/tags/v1.5.0
456def7890abc1234567890def12345678abc123 refs/tags/v2.0.0
789abc1234567890def1234567890abc123456def refs/tags/v2.1.0
      `.trim(),
            );
        });

        it("should resolve ^1.0.0 to highest 1.x.x version", async () => {
            mockListRemote.mockResolvedValueOnce(
                "123abc4567890def1234567890abc12345678def refs/tags/v1.5.0",
            );

            const result = await resolveVersion("https://github.com/org/repo.git", "^1.0.0");
            expect(result).toBe("123abc4567890def1234567890abc12345678def");
        });

        it("should resolve ~1.2.0 to highest 1.2.x version", async () => {
            mockListRemote.mockResolvedValueOnce(
                "def1234567890abc1234567890def12345678abcd refs/tags/v1.2.3",
            );

            const result = await resolveVersion("https://github.com/org/repo.git", "~1.2.0");
            expect(result).toBe("def1234567890abc1234567890def12345678abcd");
        });

        it("should resolve >=1.0.0 <2.0.0 to highest matching version", async () => {
            mockListRemote.mockResolvedValueOnce(
                "123abc4567890def1234567890abc12345678def refs/tags/v1.5.0",
            );

            const result = await resolveVersion(
                "https://github.com/org/repo.git",
                ">=1.0.0 <2.0.0",
            );
            expect(result).toBe("123abc4567890def1234567890abc12345678def");
        });

        it("should throw VersionNotFoundError when no version matches range", async () => {
            await expect(
                resolveVersion("https://github.com/org/repo.git", "^3.0.0"),
            ).rejects.toThrow(VersionNotFoundError);
        });

        it("should throw VersionNotFoundError when no semver tags exist", async () => {
            mockListRemote.mockReset();
            const noTagsResponse = `
abc1234567890def1234567890abcdef12345678 refs/heads/main
def1234567890abc1234567890def12345678abcd refs/heads/develop
      `.trim();

            // First call to resolveVersion
            mockListRemote.mockResolvedValueOnce(noTagsResponse);
            await expect(
                resolveVersion("https://github.com/org/repo.git", "^1.0.0"),
            ).rejects.toThrow(VersionNotFoundError);

            // Second call to resolveVersion
            mockListRemote.mockResolvedValueOnce(noTagsResponse);
            await expect(
                resolveVersion("https://github.com/org/repo.git", "^1.0.0"),
            ).rejects.toThrow(/No semver tags found/);
        });
    });

    describe("error handling", () => {
        it("should throw VersionNotFoundError with available versions", async () => {
            mockListRemote.mockResolvedValueOnce(
                `
abc1234567890def1234567890abcdef12345678 refs/tags/v1.0.0
def1234567890abc1234567890def12345678abcd refs/tags/v2.0.0
      `.trim(),
            );

            await expect(
                resolveVersion("https://github.com/org/repo.git", "^3.0.0"),
            ).rejects.toThrow(/Available versions: 1.0.0, 2.0.0/);
        });

        it("should wrap Git errors in VersionNotFoundError", async () => {
            mockListRemote.mockRejectedValueOnce(new Error("Repository not found"));

            await expect(
                resolveVersion("https://github.com/org/invalid.git", "latest"),
            ).rejects.toThrow(VersionNotFoundError);
        });

        it("should throw GitAuthenticationError on auth failure", async () => {
            mockListRemote.mockRejectedValueOnce(new Error("terminal prompts disabled"));
            vi.mocked(gitUtils.isAuthError).mockReturnValue(true);

            await expect(
                resolveVersion("https://github.com/org/private-repo.git", "latest"),
            ).rejects.toThrow(GitAuthenticationError);
        });

        it("should use interactive git when options.interactive is true", async () => {
            mockListRemote.mockResolvedValueOnce(
                "abc1234567890def1234567890abcdef12345678 refs/heads/main",
            );

            await resolveVersion("https://github.com/org/repo.git", "latest", {
                interactive: true,
            });

            expect(gitUtils.createInteractiveGit).toHaveBeenCalled();
            expect(gitUtils.createGit).not.toHaveBeenCalled();
        });
    });
});
