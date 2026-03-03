import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { stringify } from "yaml";
import { loadPreviousPlacedPaths } from "./sync-pipeline.js";

describe("loadPreviousPlacedPaths", () => {
    let tmpDir: string;

    beforeEach(async () => {
        tmpDir = await mkdtemp(join(tmpdir(), "baton-sync-pipeline-test-"));
    });

    afterEach(async () => {
        await rm(tmpDir, { recursive: true, force: true });
    });

    it("returns an empty set when no state.yaml exists (fresh clone / first sync)", async () => {
        const result = await loadPreviousPlacedPaths(tmpDir);
        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(0);
    });

    it("returns an empty set for old flat placed_files format (upgrade scenario — the reported bug)", async () => {
        // This is the exact format that triggered false-positive orphans before the fix.
        // state.yaml exists but uses placed_files: [...] instead of placed_files: { ai-tools, ides, files }
        await mkdir(join(tmpDir, ".baton"), { recursive: true });
        const oldFormatState = stringify({
            synced_at: "2025-01-01T00:00:00.000Z",
            tools: ["claude-code"],
            placed_files: ["skills/code-review", "memory/CLAUDE.md", "files/.claude/settings.json"],
        });
        await writeFile(join(tmpDir, ".baton", "state.yaml"), oldFormatState, "utf-8");

        // Schema validation fails → readState returns null → loadPreviousPlacedPaths returns empty set
        // This prevents the 39 false-positive orphan paths that were being shown to the user
        const result = await loadPreviousPlacedPaths(tmpDir);
        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(0);
    });

    it("returns correct disk paths from a valid new-format state.yaml", async () => {
        await mkdir(join(tmpDir, ".baton"), { recursive: true });
        const validState = stringify({
            synced_at: "2026-01-01T00:00:00.000Z",
            tools: ["claude-code", "windsurf"],
            placed_files: {
                "ai-tools": [
                    ".claude/skills/code-review",
                    ".windsurf/skills/code-review",
                    "CLAUDE.md",
                ],
                ides: [".vscode/settings.json"],
                files: ["biome.json"],
            },
        });
        await writeFile(join(tmpDir, ".baton", "state.yaml"), validState, "utf-8");

        const result = await loadPreviousPlacedPaths(tmpDir);
        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(5);
        expect(result.has(".claude/skills/code-review")).toBe(true);
        expect(result.has(".windsurf/skills/code-review")).toBe(true);
        expect(result.has("CLAUDE.md")).toBe(true);
        expect(result.has(".vscode/settings.json")).toBe(true);
        expect(result.has("biome.json")).toBe(true);
    });
});
