import { describe, expect, it } from "vitest";
import {
    getIdePlatformTargetDir,
    getRegisteredIdePlatforms,
    idePlatformRegistry,
    isKnownIdePlatform,
} from "./platform-registry.js";

describe("platform-registry", () => {
    describe("idePlatformRegistry", () => {
        it("contains all expected IDE platforms", () => {
            const platforms = Object.keys(idePlatformRegistry);
            expect(platforms).toContain("vscode");
            expect(platforms).toContain("jetbrains");
            expect(platforms).toContain("cursor");
            expect(platforms).toContain("windsurf");
            expect(platforms).toContain("antigravity");
            expect(platforms).toContain("zed");
        });

        it("each platform has a targetDir", () => {
            for (const [_key, entry] of Object.entries(idePlatformRegistry)) {
                expect(entry.targetDir).toBeDefined();
                expect(typeof entry.targetDir).toBe("string");
                expect(entry.targetDir.length).toBeGreaterThan(0);
            }
        });

        it("each platform has detectionConfig with at least one group", () => {
            for (const [_key, entry] of Object.entries(idePlatformRegistry)) {
                expect(entry.detectionConfig).toBeDefined();
                expect(entry.detectionConfig.groups.length).toBeGreaterThan(0);
            }
        });
    });

    describe("getIdePlatformTargetDir", () => {
        it("returns target dir for known platform", () => {
            expect(getIdePlatformTargetDir("vscode")).toBe(".vscode");
            expect(getIdePlatformTargetDir("jetbrains")).toBe(".idea");
        });

        it("returns undefined for unknown platform", () => {
            expect(getIdePlatformTargetDir("unknown-ide")).toBeUndefined();
        });
    });

    describe("isKnownIdePlatform", () => {
        it("returns true for registered platforms", () => {
            expect(isKnownIdePlatform("vscode")).toBe(true);
            expect(isKnownIdePlatform("cursor")).toBe(true);
        });

        it("returns false for unknown platforms", () => {
            expect(isKnownIdePlatform("sublime")).toBe(false);
        });
    });

    describe("getRegisteredIdePlatforms", () => {
        it("returns all platform keys", () => {
            const platforms = getRegisteredIdePlatforms();
            expect(platforms).toHaveLength(Object.keys(idePlatformRegistry).length);
            expect(platforms).toContain("vscode");
            expect(platforms).toContain("zed");
        });
    });
});
