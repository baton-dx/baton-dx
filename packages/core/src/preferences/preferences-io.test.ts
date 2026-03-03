import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ManifestValidationError } from "../errors.js";
import {
    deleteProjectPreferences,
    getPreferencesPath,
    readProjectPreferences,
    writeProjectPreferences,
} from "./preferences-io.js";

describe("Project Preferences I/O", () => {
    let projectRoot: string;

    beforeEach(async () => {
        projectRoot = join(
            tmpdir(),
            `baton-prefs-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        );
        await mkdir(projectRoot, { recursive: true });
    });

    afterEach(async () => {
        await rm(projectRoot, { recursive: true, force: true });
    });

    describe("getPreferencesPath", () => {
        it("returns .baton/preferences.yaml relative to project root", () => {
            const result = getPreferencesPath("/my/project");
            expect(result).toBe(join("/my/project", ".baton", "preferences.yaml"));
        });
    });

    describe("readProjectPreferences", () => {
        it("returns null when file does not exist", async () => {
            const result = await readProjectPreferences(projectRoot);
            expect(result).toBeNull();
        });

        it("returns parsed preferences when file exists", async () => {
            const prefsPath = getPreferencesPath(projectRoot);
            await mkdir(join(projectRoot, ".baton"), { recursive: true });
            await writeFile(
                prefsPath,
                "version: '1.0'\nai:\n  useGlobal: false\n  tools:\n    - claude-code\nide:\n  useGlobal: true\n  platforms: []\n",
                "utf-8",
            );

            const result = await readProjectPreferences(projectRoot);
            expect(result).not.toBeNull();
            expect(result?.version).toBe("1.0");
            expect(result?.ai.useGlobal).toBe(false);
            expect(result?.ai.tools).toEqual(["claude-code"]);
            expect(result?.ide.useGlobal).toBe(true);
        });

        it("throws ManifestValidationError for invalid content", async () => {
            const prefsPath = getPreferencesPath(projectRoot);
            await mkdir(join(projectRoot, ".baton"), { recursive: true });
            await writeFile(prefsPath, "version: '2.0'\nai:\n  useGlobal: 'maybe'\n", "utf-8");

            await expect(readProjectPreferences(projectRoot)).rejects.toThrow(
                ManifestValidationError,
            );
        });
    });

    describe("writeProjectPreferences", () => {
        it("writes preferences and creates .baton/ directory", async () => {
            const prefs = {
                version: "1.0" as const,
                ai: { useGlobal: false, tools: ["claude-code", "cursor"] },
                ide: { useGlobal: true, platforms: [] as string[] },
            };

            await writeProjectPreferences(projectRoot, prefs);

            const prefsPath = getPreferencesPath(projectRoot);
            const content = await readFile(prefsPath, "utf-8");
            expect(content).toContain('version: "1.0"');
            expect(content).toContain("claude-code");
        });

        it("writes when .baton/ directory already exists", async () => {
            await mkdir(join(projectRoot, ".baton"), { recursive: true });

            const prefs = {
                version: "1.0" as const,
                ai: { useGlobal: true, tools: [] as string[] },
                ide: { useGlobal: true, platforms: [] as string[] },
            };

            await writeProjectPreferences(projectRoot, prefs);

            const result = await readProjectPreferences(projectRoot);
            expect(result).not.toBeNull();
            expect(result?.ai.useGlobal).toBe(true);
        });

        it("round-trips preferences correctly", async () => {
            const prefs = {
                version: "1.0" as const,
                ai: { useGlobal: false, tools: ["claude-code"] },
                ide: { useGlobal: false, platforms: ["vscode", "cursor"] },
            };

            await writeProjectPreferences(projectRoot, prefs);
            const result = await readProjectPreferences(projectRoot);

            expect(result).toEqual(prefs);
        });

        it("ensures .baton/ is added to .gitignore", async () => {
            const prefs = {
                version: "1.0" as const,
                ai: { useGlobal: true, tools: [] as string[] },
                ide: { useGlobal: true, platforms: [] as string[] },
            };

            await writeProjectPreferences(projectRoot, prefs);

            const gitignore = await readFile(join(projectRoot, ".gitignore"), "utf-8");
            expect(gitignore).toContain(".baton/");
        });

        it("does not duplicate .baton/ in .gitignore if already present", async () => {
            await writeFile(join(projectRoot, ".gitignore"), "# Baton local\n.baton/\n", "utf-8");

            const prefs = {
                version: "1.0" as const,
                ai: { useGlobal: true, tools: [] as string[] },
                ide: { useGlobal: true, platforms: [] as string[] },
            };

            await writeProjectPreferences(projectRoot, prefs);

            const gitignore = await readFile(join(projectRoot, ".gitignore"), "utf-8");
            const matches = gitignore.match(/\.baton\//g);
            expect(matches?.length).toBe(1);
        });
    });

    describe("deleteProjectPreferences", () => {
        it("deletes existing preferences file", async () => {
            const prefs = {
                version: "1.0" as const,
                ai: { useGlobal: true, tools: [] as string[] },
                ide: { useGlobal: true, platforms: [] as string[] },
            };

            await writeProjectPreferences(projectRoot, prefs);
            expect(await readProjectPreferences(projectRoot)).not.toBeNull();

            await deleteProjectPreferences(projectRoot);
            expect(await readProjectPreferences(projectRoot)).toBeNull();
        });

        it("does not throw when file does not exist", async () => {
            await expect(deleteProjectPreferences(projectRoot)).resolves.toBeUndefined();
        });
    });
});
