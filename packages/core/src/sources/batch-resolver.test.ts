import { describe, expect, it } from "vitest";
import { pLimit } from "./batch-resolver.js";

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
