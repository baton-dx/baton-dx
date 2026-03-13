import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseSource } from "../utils/index.js";
import { checkRemoteSha, getPackageNameFromSource, pLimit } from "./batch-resolver.js";
import * as gitUtils from "./git-utils.js";

vi.mock("./git-utils.js", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./git-utils.js")>()),
    createGit: vi.fn(),
    withTokenAuth: vi.fn(),
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
            mockGit as ReturnType<typeof gitUtils.createGit>,
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
            mockGit as ReturnType<typeof gitUtils.createGit>,
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
            mockGit as ReturnType<typeof gitUtils.createGit>,
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
            mockGit as ReturnType<typeof gitUtils.createGit>,
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
            mockGit as ReturnType<typeof gitUtils.createGit>,
        );
        vi.mocked(gitUtils.withTokenAuth).mockReturnValue(
            authedGit as ReturnType<typeof gitUtils.withTokenAuth>,
        );

        await checkRemoteSha("https://github.com/org/repo.git", "abc1", "my-token");

        expect(gitUtils.withTokenAuth).toHaveBeenCalledWith(
            mockGit,
            "https://github.com/org/repo.git",
            "my-token",
        );
    });
});
