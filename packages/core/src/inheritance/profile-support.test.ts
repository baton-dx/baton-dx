import { describe, expect, it } from "vitest";
import { getAllAIToolAdapters } from "../adapters/registry.js";
import type { ProfileManifest } from "../schemas/profile-manifest.js";
import {
    type ResolvedProfileSupport,
    resolveProfileSupport,
    type SourceManifest,
} from "./profile-support.js";

/**
 * Helper to create a minimal profile manifest for testing
 */
function makeProfile(overrides: Partial<ProfileManifest> = {}): ProfileManifest {
    return {
        name: "test-profile",
        version: "1.0.0",
        ...overrides,
    };
}

/**
 * Helper to create a minimal source manifest for testing
 */
function makeSource(overrides: Partial<SourceManifest> = {}): SourceManifest {
    return {
        name: "test-source",
        version: "1.0.0",
        ...overrides,
    };
}

describe("resolveProfileSupport", () => {
    describe("AI tools inheritance", () => {
        it("returns profile ai.tools when profile defines them", () => {
            const profile = makeProfile({ ai: { tools: ["cursor", "claude-code"] } });
            const source = makeSource({ ai: { tools: ["cursor", "claude-code", "windsurf"] } });

            const result = resolveProfileSupport(profile, source);

            expect(result.aiTools).toEqual(["cursor", "claude-code"]);
        });

        it("falls back to source ai.tools when profile has no ai section", () => {
            const profile = makeProfile();
            const source = makeSource({ ai: { tools: ["cursor", "windsurf"] } });

            const result = resolveProfileSupport(profile, source);

            expect(result.aiTools).toEqual(["cursor", "windsurf"]);
        });

        it("falls back to source ai.tools when profile ai has no tools field", () => {
            const profile = makeProfile({ ai: {} });
            const source = makeSource({ ai: { tools: ["claude-code"] } });

            const result = resolveProfileSupport(profile, source);

            expect(result.aiTools).toEqual(["claude-code"]);
        });

        it("uses profile empty array when profile explicitly sets tools to empty", () => {
            const profile = makeProfile({ ai: { tools: [] } });
            const source = makeSource({ ai: { tools: ["cursor", "claude-code"] } });

            const result = resolveProfileSupport(profile, source);

            expect(result.aiTools).toEqual([]);
        });

        it("returns empty array when neither profile nor source define tools", () => {
            const profile = makeProfile();
            const source = makeSource();

            const result = resolveProfileSupport(profile, source);

            expect(result.aiTools).toEqual([]);
        });

        it("returns empty array when source has ai section but no tools", () => {
            const profile = makeProfile();
            const source = makeSource({ ai: {} });

            const result = resolveProfileSupport(profile, source);

            expect(result.aiTools).toEqual([]);
        });

        it("allows profile to have a subset of source tools", () => {
            const profile = makeProfile({ ai: { tools: ["cursor"] } });
            const source = makeSource({
                ai: { tools: ["cursor", "claude-code", "windsurf", "codex"] },
            });

            const result = resolveProfileSupport(profile, source);

            expect(result.aiTools).toEqual(["cursor"]);
        });
    });

    describe("AI tools wildcard inference", () => {
        const allToolKeys = getAllAIToolAdapters().map((a) => a.key);

        it("returns all tool keys when profile has ai section but no ai.tools", () => {
            // In v2, having an `ai` section (even empty) indicates AI content
            const profile = makeProfile({ ai: {} });
            const source = makeSource();

            const result = resolveProfileSupport(profile, source);

            expect(result.aiTools).toEqual(allToolKeys);
        });

        it("prefers explicit ai.tools over wildcard inference", () => {
            const profile = makeProfile({
                ai: { tools: ["cursor"] },
            });
            const source = makeSource();

            const result = resolveProfileSupport(profile, source);

            expect(result.aiTools).toEqual(["cursor"]);
        });

        it("prefers source ai.tools fallback over wildcard inference", () => {
            const profile = makeProfile({ ai: {} });
            const source = makeSource({ ai: { tools: ["claude-code", "cursor"] } });

            const result = resolveProfileSupport(profile, source);

            expect(result.aiTools).toEqual(["claude-code", "cursor"]);
        });
    });

    describe('explicit "*" wildcard in ai.tools', () => {
        const allToolKeys = getAllAIToolAdapters().map((a) => a.key);

        it('expands profile ai.tools: ["*"] to all tool keys', () => {
            const profile = makeProfile({ ai: { tools: ["*"] } });
            const source = makeSource();

            const result = resolveProfileSupport(profile, source);

            expect(result.aiTools).toEqual(allToolKeys);
        });

        it('expands source ai.tools: ["*"] to all tool keys', () => {
            const profile = makeProfile({ ai: {} });
            const source = makeSource({ ai: { tools: ["*"] } });

            const result = resolveProfileSupport(profile, source);

            expect(result.aiTools).toEqual(allToolKeys);
        });

        it('profile explicit tools override source "*" wildcard', () => {
            const profile = makeProfile({ ai: { tools: ["cursor"] } });
            const source = makeSource({ ai: { tools: ["*"] } });

            const result = resolveProfileSupport(profile, source);

            expect(result.aiTools).toEqual(["cursor"]);
        });

        it('profile "*" wildcard overrides source explicit tools', () => {
            const profile = makeProfile({ ai: { tools: ["*"] } });
            const source = makeSource({ ai: { tools: ["cursor", "claude-code"] } });

            const result = resolveProfileSupport(profile, source);

            expect(result.aiTools).toEqual(allToolKeys);
        });
    });

    describe("IDE platforms resolution", () => {
        it("returns source ide.platforms", () => {
            const profile = makeProfile();
            const source = makeSource({ ide: { platforms: ["vscode", "cursor"] } });

            const result = resolveProfileSupport(profile, source);

            expect(result.idePlatforms).toEqual(["vscode", "cursor"]);
        });

        it("returns empty array when source has no ide platforms", () => {
            const profile = makeProfile();
            const source = makeSource();

            const result = resolveProfileSupport(profile, source);

            expect(result.idePlatforms).toEqual([]);
        });

        it("returns empty array when source has ide section but no platforms", () => {
            const profile = makeProfile();
            const source = makeSource({ ide: {} });

            const result = resolveProfileSupport(profile, source);

            expect(result.idePlatforms).toEqual([]);
        });
    });

    describe("combined resolution", () => {
        it("resolves both ai tools and ide platforms", () => {
            const profile = makeProfile({
                ai: { tools: ["claude-code", "cursor"] },
            });
            const source = makeSource({
                ai: { tools: ["claude-code", "cursor", "windsurf"] },
                ide: { platforms: ["vscode", "jetbrains", "zed"] },
            });

            const result = resolveProfileSupport(profile, source);

            expect(result.aiTools).toEqual(["claude-code", "cursor"]);
            expect(result.idePlatforms).toEqual(["vscode", "jetbrains", "zed"]);
        });

        it("resolves ai from profile and ide from source", () => {
            const profile = makeProfile({
                ai: { tools: ["cursor"] },
            });
            const source = makeSource({
                ai: { tools: ["cursor", "claude-code"] },
                ide: { platforms: ["vscode", "jetbrains"] },
            });

            const result = resolveProfileSupport(profile, source);

            expect(result.aiTools).toEqual(["cursor"]);
            expect(result.idePlatforms).toEqual(["vscode", "jetbrains"]);
        });

        it("returns empty arrays when both profile and source are minimal", () => {
            const profile = makeProfile();
            const source = makeSource();

            const result: ResolvedProfileSupport = resolveProfileSupport(profile, source);

            expect(result.aiTools).toEqual([]);
            expect(result.idePlatforms).toEqual([]);
        });
    });
});
