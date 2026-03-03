import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { stringify } from "yaml";
import { checkStale } from "./check.js";

describe("checkStale", () => {
    const testDir = join(tmpdir(), `baton-stale-test-${Date.now()}`);

    beforeEach(async () => {
        await mkdir(join(testDir, ".baton"), { recursive: true });
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    async function writeBatonYaml(content = "profiles: []") {
        await writeFile(join(testDir, "baton.yaml"), content, "utf-8");
    }

    async function writeLockfile(packages: Record<string, unknown> = {}) {
        const lockfile = {
            locked_at: new Date().toISOString(),
            packages,
        };
        await writeFile(join(testDir, "baton.lock"), stringify(lockfile), "utf-8");
    }

    async function writeState(
        placedFiles: { "ai-tools": string[]; ides: string[]; files: string[] } = {
            "ai-tools": [],
            ides: [],
            files: [],
        },
    ) {
        const state = {
            synced_at: new Date().toISOString(),
            tools: ["claude-code"],
            placed_files: placedFiles,
        };
        await writeFile(join(testDir, ".baton", "state.yaml"), stringify(state), "utf-8");
    }

    it("returns not stale when everything is in sync", async () => {
        await writeBatonYaml();
        await writeLockfile();
        await writeState();

        const result = await checkStale(testDir);
        expect(result.stale).toBe(false);
        expect(result.reasons).toEqual([]);
    });

    it("detects missing lockfile", async () => {
        await writeBatonYaml();
        await writeState();

        const result = await checkStale(testDir);
        expect(result.stale).toBe(true);
        expect(result.reasons).toContainEqual(expect.stringContaining("baton.lock not found"));
    });

    it("detects missing state.yaml", async () => {
        await writeBatonYaml();
        await writeLockfile();

        const result = await checkStale(testDir);
        expect(result.stale).toBe(true);
        expect(result.reasons).toContainEqual(expect.stringContaining("state.yaml not found"));
    });

    it("detects missing placed files", async () => {
        await writeBatonYaml();
        await writeLockfile();
        await writeState({
            "ai-tools": [".claude/rules/coding.md"],
            ides: [],
            files: [],
        });

        const result = await checkStale(testDir);
        expect(result.stale).toBe(true);
        expect(result.reasons).toContainEqual(expect.stringContaining("Missing placed file"));
    });

    it("detects baton.yaml modified after sync", async () => {
        await writeBatonYaml();
        await writeLockfile();
        // Write state with a timestamp in the past
        const pastState = {
            synced_at: new Date(Date.now() - 60_000).toISOString(),
            tools: ["claude-code"],
            placed_files: { "ai-tools": [], ides: [], files: [] },
        };
        await writeFile(join(testDir, ".baton", "state.yaml"), stringify(pastState), "utf-8");

        // Touch baton.yaml to make it newer
        await writeFile(
            join(testDir, "baton.yaml"),
            "profiles:\n  - source: ./my-profile",
            "utf-8",
        );

        const result = await checkStale(testDir);
        expect(result.stale).toBe(true);
        expect(result.reasons).toContainEqual(
            expect.stringContaining("baton.yaml has been modified since last sync"),
        );
    });

    it("detects file integrity mismatch", async () => {
        await writeBatonYaml();

        const originalContent = '{ "semi": true }';
        const originalHash = createHash("sha256").update(originalContent).digest("hex");

        await writeLockfile({
            "my-profile": {
                source: "./profiles/my-profile",
                resolved: "./profiles/my-profile",
                version: "1.0.0",
                sha: "abc123",
                integrity: {
                    "files/biome.json": {
                        hash: originalHash,
                        type: "files",
                    },
                },
            },
        });

        await writeState({ "ai-tools": [], ides: [], files: ["biome.json"] });

        // Write a different content on disk
        await writeFile(join(testDir, "biome.json"), '{ "semi": false }', "utf-8");

        const result = await checkStale(testDir);
        expect(result.stale).toBe(true);
        expect(result.reasons).toContainEqual(
            expect.stringContaining("File integrity mismatch: biome.json"),
        );
    });

    it("passes file integrity check when content matches", async () => {
        await writeBatonYaml();

        const content = '{ "semi": true }';
        const hash = createHash("sha256").update(content).digest("hex");

        await writeLockfile({
            "my-profile": {
                source: "./profiles/my-profile",
                resolved: "./profiles/my-profile",
                version: "1.0.0",
                sha: "abc123",
                integrity: {
                    "files/biome.json": {
                        hash,
                        type: "files",
                    },
                },
            },
        });

        await writeState({ "ai-tools": [], ides: [], files: ["biome.json"] });
        await writeFile(join(testDir, "biome.json"), content, "utf-8");

        const result = await checkStale(testDir);
        expect(result.stale).toBe(false);
        expect(result.reasons).toEqual([]);
    });
});
