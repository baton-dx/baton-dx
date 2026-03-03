import { describe, expect, it } from "vitest";
import type { ResolvedProfileSupport } from "../inheritance/profile-support.js";
import { computeIntersection, type DeveloperTools } from "./compute.js";

/**
 * Helper to create developer tools config
 */
function makeDevTools(aiTools: string[] = [], idePlatforms: string[] = []): DeveloperTools {
    return { aiTools, idePlatforms };
}

/**
 * Helper to create resolved profile support
 */
function makeProfileSupport(
    aiTools: string[] = [],
    idePlatforms: string[] = [],
): ResolvedProfileSupport {
    return { aiTools, idePlatforms };
}

describe("computeIntersection", () => {
    describe("empty arrays", () => {
        it("returns empty results when both developer tools and profile support are empty", () => {
            const result = computeIntersection(makeDevTools(), makeProfileSupport());

            expect(result.aiTools.synced).toEqual([]);
            expect(result.aiTools.unsupported).toEqual([]);
            expect(result.aiTools.unavailable).toEqual([]);
            expect(result.idePlatforms.synced).toEqual([]);
            expect(result.idePlatforms.unsupported).toEqual([]);
            expect(result.idePlatforms.unavailable).toEqual([]);
        });

        it("returns all developer tools as unsupported when profile has no tools", () => {
            const result = computeIntersection(
                makeDevTools(["claude-code", "cursor"], ["vscode"]),
                makeProfileSupport(),
            );

            expect(result.aiTools.synced).toEqual([]);
            expect(result.aiTools.unsupported).toEqual(["claude-code", "cursor"]);
            expect(result.aiTools.unavailable).toEqual([]);
            expect(result.idePlatforms.synced).toEqual([]);
            expect(result.idePlatforms.unsupported).toEqual(["vscode"]);
            expect(result.idePlatforms.unavailable).toEqual([]);
        });

        it("returns all profile tools as unavailable when developer has no tools", () => {
            const result = computeIntersection(
                makeDevTools(),
                makeProfileSupport(["claude-code", "cursor"], ["vscode", "jetbrains"]),
            );

            expect(result.aiTools.synced).toEqual([]);
            expect(result.aiTools.unsupported).toEqual([]);
            expect(result.aiTools.unavailable).toEqual(["claude-code", "cursor"]);
            expect(result.idePlatforms.synced).toEqual([]);
            expect(result.idePlatforms.unsupported).toEqual([]);
            expect(result.idePlatforms.unavailable).toEqual(["vscode", "jetbrains"]);
        });
    });

    describe("full overlap", () => {
        it("returns all items as synced when sets are identical", () => {
            const result = computeIntersection(
                makeDevTools(["claude-code", "cursor"], ["vscode", "jetbrains"]),
                makeProfileSupport(["claude-code", "cursor"], ["vscode", "jetbrains"]),
            );

            expect(result.aiTools.synced).toEqual(["claude-code", "cursor"]);
            expect(result.aiTools.unsupported).toEqual([]);
            expect(result.aiTools.unavailable).toEqual([]);
            expect(result.idePlatforms.synced).toEqual(["vscode", "jetbrains"]);
            expect(result.idePlatforms.unsupported).toEqual([]);
            expect(result.idePlatforms.unavailable).toEqual([]);
        });

        it("handles single item full overlap", () => {
            const result = computeIntersection(
                makeDevTools(["claude-code"], ["vscode"]),
                makeProfileSupport(["claude-code"], ["vscode"]),
            );

            expect(result.aiTools.synced).toEqual(["claude-code"]);
            expect(result.aiTools.unsupported).toEqual([]);
            expect(result.aiTools.unavailable).toEqual([]);
            expect(result.idePlatforms.synced).toEqual(["vscode"]);
            expect(result.idePlatforms.unsupported).toEqual([]);
            expect(result.idePlatforms.unavailable).toEqual([]);
        });
    });

    describe("no overlap", () => {
        it("returns no synced items when sets are completely disjoint", () => {
            const result = computeIntersection(
                makeDevTools(["claude-code", "codex"], ["vscode"]),
                makeProfileSupport(["cursor", "windsurf"], ["jetbrains", "zed"]),
            );

            expect(result.aiTools.synced).toEqual([]);
            expect(result.aiTools.unsupported).toEqual(["claude-code", "codex"]);
            expect(result.aiTools.unavailable).toEqual(["cursor", "windsurf"]);
            expect(result.idePlatforms.synced).toEqual([]);
            expect(result.idePlatforms.unsupported).toEqual(["vscode"]);
            expect(result.idePlatforms.unavailable).toEqual(["jetbrains", "zed"]);
        });
    });

    describe("partial overlap (subset)", () => {
        it("developer has a subset of profile tools", () => {
            const result = computeIntersection(
                makeDevTools(["claude-code"], ["vscode"]),
                makeProfileSupport(["claude-code", "cursor", "windsurf"], ["vscode", "jetbrains"]),
            );

            expect(result.aiTools.synced).toEqual(["claude-code"]);
            expect(result.aiTools.unsupported).toEqual([]);
            expect(result.aiTools.unavailable).toEqual(["cursor", "windsurf"]);
            expect(result.idePlatforms.synced).toEqual(["vscode"]);
            expect(result.idePlatforms.unsupported).toEqual([]);
            expect(result.idePlatforms.unavailable).toEqual(["jetbrains"]);
        });

        it("profile supports a subset of developer tools", () => {
            const result = computeIntersection(
                makeDevTools(["claude-code", "cursor", "codex"], ["vscode", "jetbrains", "zed"]),
                makeProfileSupport(["claude-code"], ["vscode"]),
            );

            expect(result.aiTools.synced).toEqual(["claude-code"]);
            expect(result.aiTools.unsupported).toEqual(["cursor", "codex"]);
            expect(result.aiTools.unavailable).toEqual([]);
            expect(result.idePlatforms.synced).toEqual(["vscode"]);
            expect(result.idePlatforms.unsupported).toEqual(["jetbrains", "zed"]);
            expect(result.idePlatforms.unavailable).toEqual([]);
        });

        it("partial overlap with items on both sides", () => {
            const result = computeIntersection(
                makeDevTools(["claude-code", "cursor", "codex"], ["vscode", "zed"]),
                makeProfileSupport(["claude-code", "windsurf", "cursor"], ["vscode", "jetbrains"]),
            );

            expect(result.aiTools.synced).toEqual(["claude-code", "cursor"]);
            expect(result.aiTools.unsupported).toEqual(["codex"]);
            expect(result.aiTools.unavailable).toEqual(["windsurf"]);
            expect(result.idePlatforms.synced).toEqual(["vscode"]);
            expect(result.idePlatforms.unsupported).toEqual(["zed"]);
            expect(result.idePlatforms.unavailable).toEqual(["jetbrains"]);
        });
    });

    describe("mixed dimensions", () => {
        it("handles AI tools with overlap and IDE platforms without overlap independently", () => {
            const result = computeIntersection(
                makeDevTools(["claude-code", "cursor"], ["vscode"]),
                makeProfileSupport(["claude-code"], ["jetbrains"]),
            );

            // AI: claude-code synced, cursor unsupported
            expect(result.aiTools.synced).toEqual(["claude-code"]);
            expect(result.aiTools.unsupported).toEqual(["cursor"]);
            expect(result.aiTools.unavailable).toEqual([]);

            // IDE: no overlap
            expect(result.idePlatforms.synced).toEqual([]);
            expect(result.idePlatforms.unsupported).toEqual(["vscode"]);
            expect(result.idePlatforms.unavailable).toEqual(["jetbrains"]);
        });

        it("handles empty AI tools but populated IDE platforms", () => {
            const result = computeIntersection(
                makeDevTools([], ["vscode", "jetbrains"]),
                makeProfileSupport([], ["vscode"]),
            );

            expect(result.aiTools.synced).toEqual([]);
            expect(result.aiTools.unsupported).toEqual([]);
            expect(result.aiTools.unavailable).toEqual([]);
            expect(result.idePlatforms.synced).toEqual(["vscode"]);
            expect(result.idePlatforms.unsupported).toEqual(["jetbrains"]);
            expect(result.idePlatforms.unavailable).toEqual([]);
        });
    });

    describe("order preservation", () => {
        it("preserves developer order for synced and unsupported items", () => {
            const result = computeIntersection(
                makeDevTools(["codex", "claude-code", "cursor"]),
                makeProfileSupport(["cursor", "claude-code"]),
            );

            // synced follows developer order, not profile order
            expect(result.aiTools.synced).toEqual(["claude-code", "cursor"]);
            expect(result.aiTools.unsupported).toEqual(["codex"]);
        });

        it("preserves profile order for unavailable items", () => {
            const result = computeIntersection(
                makeDevTools(["claude-code"]),
                makeProfileSupport(["windsurf", "claude-code", "cursor"]),
            );

            // unavailable follows profile order
            expect(result.aiTools.unavailable).toEqual(["windsurf", "cursor"]);
        });
    });

    describe("duplicate handling", () => {
        it("handles duplicates in developer tools gracefully", () => {
            const result = computeIntersection(
                makeDevTools(["claude-code", "claude-code"]),
                makeProfileSupport(["claude-code"]),
            );

            // Both instances are in the synced set since both match
            expect(result.aiTools.synced).toEqual(["claude-code", "claude-code"]);
            expect(result.aiTools.unsupported).toEqual([]);
            expect(result.aiTools.unavailable).toEqual([]);
        });
    });
});
