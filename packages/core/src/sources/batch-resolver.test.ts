import { describe, expect, it } from "vitest";
import { parseSource } from "../utils/index.js";
import { getPackageNameFromSource, pLimit } from "./batch-resolver.js";

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
