import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isInSourceRepo } from "./context-detection.js";

describe("isInSourceRepo", () => {
    const testDir = join(process.cwd(), "test-context-detection");
    const sourceRepoDir = join(testDir, "source-repo");
    const emptyDir = join(testDir, "empty-dir");

    beforeEach(async () => {
        // Clean up and create test directories
        await rm(testDir, { recursive: true, force: true });
        await mkdir(sourceRepoDir, { recursive: true });
        await mkdir(emptyDir, { recursive: true });

        // Create baton.source.yaml in source-repo
        await writeFile(
            join(sourceRepoDir, "baton.source.yaml"),
            "name: test-source\nversion: 1.0.0\n",
        );
    });

    afterEach(async () => {
        // Clean up test directories
        await rm(testDir, { recursive: true, force: true });
    });

    it("should return true when baton.source.yaml exists", async () => {
        const result = await isInSourceRepo(sourceRepoDir);
        expect(result).toBe(true);
    });

    it("should return false when baton.source.yaml does not exist", async () => {
        const result = await isInSourceRepo(emptyDir);
        expect(result).toBe(false);
    });

    it("should return false for non-existent directory", async () => {
        const nonExistentDir = join(testDir, "non-existent");
        const result = await isInSourceRepo(nonExistentDir);
        expect(result).toBe(false);
    });

    it("should use process.cwd() when no path provided", async () => {
        // This test verifies the function accepts an optional parameter
        // In real usage, it checks the current working directory
        const result = await isInSourceRepo();
        expect(typeof result).toBe("boolean");
    });
});
