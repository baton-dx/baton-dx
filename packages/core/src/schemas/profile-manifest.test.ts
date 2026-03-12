import { describe, expect, it } from "vitest";
import {
    detectLegacyFields,
    mergeStrategySchema,
    profileManifestSchema,
    scopeSchema,
} from "./profile-manifest.js";

describe("Schema Validation - Profile Manifest", () => {
    describe("Valid manifests", () => {
        it("validates minimal profile manifest", () => {
            const result = profileManifestSchema.safeParse({
                name: "minimal-profile",
                version: "1.0.0",
            });

            expect(result.success).toBe(true);
        });

        it("validates profile manifest with ai.tools", () => {
            const result = profileManifestSchema.safeParse({
                name: "full-profile",
                version: "2.3.5",
                description: "Profile with tools only",
                extends: "base-profile",
                ai: {
                    tools: ["claude-code", "cursor"],
                },
                variables: {
                    PROJECT_NAME: "my-project",
                },
                hooks: {
                    "post-install": "echo 'Installed'",
                    "post-update": "echo 'Updated'",
                },
            });

            expect(result.success).toBe(true);
        });

        it("validates profile with empty ai section", () => {
            const result = profileManifestSchema.safeParse({
                name: "test",
                version: "1.0.0",
                ai: {},
            });

            expect(result.success).toBe(true);
        });

        it("validates profile with ai.tools as wildcard", () => {
            const result = profileManifestSchema.safeParse({
                name: "test",
                version: "1.0.0",
                ai: { tools: ["*"] },
            });

            expect(result.success).toBe(true);
        });
    });

    describe("Invalid manifests", () => {
        it("rejects missing name", () => {
            const result = profileManifestSchema.safeParse({
                version: "1.0.0",
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].path).toContain("name");
            }
        });

        it("rejects non-kebab-case profile names", () => {
            const invalidNames = [
                "MyProfile",
                "my_profile",
                "my--profile",
                "-profile",
                "profile-",
                "UPPERCASE",
            ];
            for (const name of invalidNames) {
                const result = profileManifestSchema.safeParse({
                    name,
                    version: "1.0.0",
                });
                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error.issues[0].message).toContain("kebab-case");
                }
            }
        });

        it("accepts valid kebab-case profile names", () => {
            const validNames = [
                "test",
                "my-profile",
                "frontend",
                "team-dx-standards",
                "a1",
                "abc-123-xyz",
                "3d",
                "123-profile",
                "3d-web",
            ];
            for (const name of validNames) {
                const result = profileManifestSchema.safeParse({
                    name,
                    version: "1.0.0",
                });
                expect(result.success).toBe(true);
            }
        });

        it("rejects missing version", () => {
            const result = profileManifestSchema.safeParse({
                name: "test",
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].path).toContain("version");
            }
        });

        it("rejects invalid semver version", () => {
            const result = profileManifestSchema.safeParse({
                name: "test",
                version: "not-a-version",
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toContain("semver");
            }
        });

        it("rejects version without patch", () => {
            const result = profileManifestSchema.safeParse({
                name: "test",
                version: "1.0",
            });

            expect(result.success).toBe(false);
        });
    });

    describe("schema rejects legacy content fields", () => {
        it("ignores (strips) unknown ai fields via Zod", () => {
            // Zod by default strips unknown keys, so legacy fields in ai.* just get ignored
            const result = profileManifestSchema.safeParse({
                name: "test",
                version: "1.0.0",
                ai: {
                    tools: ["claude-code"],
                    rules: ["coding-standards"],
                    memory: [{ source: "MEMORY.md", merge: "append" }],
                },
            });

            // Zod strips unknown keys — rules and memory are silently removed
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.ai).toEqual({ tools: ["claude-code"] });
            }
        });

        it("ignores unknown top-level fields via Zod", () => {
            const result = profileManifestSchema.safeParse({
                name: "test",
                version: "1.0.0",
                files: [{ source: "biome.json" }],
                ide: { vscode: ["settings.json"] },
            });

            // Zod strips unknown top-level keys
            expect(result.success).toBe(true);
            if (result.success) {
                expect((result.data as Record<string, unknown>).files).toBeUndefined();
                expect((result.data as Record<string, unknown>).ide).toBeUndefined();
            }
        });
    });

    describe("Weight property", () => {
        it("accepts profile with weight 0 (default)", () => {
            const result = profileManifestSchema.safeParse({
                name: "test",
                version: "1.0.0",
                weight: 0,
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.weight).toBe(0);
            }
        });

        it("accepts profile with positive weight", () => {
            const result = profileManifestSchema.safeParse({
                name: "high-priority",
                version: "1.0.0",
                weight: 10,
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.weight).toBe(10);
            }
        });

        it("accepts profile with weight -1 (lock)", () => {
            const result = profileManifestSchema.safeParse({
                name: "locked-profile",
                version: "1.0.0",
                weight: -1,
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.weight).toBe(-1);
            }
        });

        it("accepts profile without weight (optional)", () => {
            const result = profileManifestSchema.safeParse({
                name: "no-weight",
                version: "1.0.0",
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.weight).toBeUndefined();
            }
        });

        it("rejects weight less than -1", () => {
            const result = profileManifestSchema.safeParse({
                name: "test",
                version: "1.0.0",
                weight: -2,
            });

            expect(result.success).toBe(false);
        });

        it("rejects non-integer weight", () => {
            const result = profileManifestSchema.safeParse({
                name: "test",
                version: "1.0.0",
                weight: 1.5,
            });

            expect(result.success).toBe(false);
        });

        it("has no upper limit for positive weight", () => {
            const result = profileManifestSchema.safeParse({
                name: "test",
                version: "1.0.0",
                weight: 9999,
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.weight).toBe(9999);
            }
        });
    });

    describe("Scope property", () => {
        it("validates profile manifest with scope field", () => {
            const result = profileManifestSchema.safeParse({
                name: "test",
                version: "1.0.0",
                scope: "project",
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.scope).toBe("project");
            }
        });

        it("validates profile manifest with scope 'global'", () => {
            const result = profileManifestSchema.safeParse({
                name: "test",
                version: "1.0.0",
                scope: "global",
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.scope).toBe("global");
            }
        });

        it("validates profile manifest without scope (optional)", () => {
            const result = profileManifestSchema.safeParse({
                name: "test",
                version: "1.0.0",
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.scope).toBeUndefined();
            }
        });
    });

    describe("Schema types", () => {
        it("validates scope schema with project and global", () => {
            expect(scopeSchema.safeParse("project").success).toBe(true);
            expect(scopeSchema.safeParse("global").success).toBe(true);
            expect(scopeSchema.safeParse("invalid").success).toBe(false);
        });

        it("validates merge strategy schema with supported strategies only", () => {
            expect(mergeStrategySchema.safeParse("concat").success).toBe(true);
            expect(mergeStrategySchema.safeParse("replace").success).toBe(true);
        });

        it("rejects legacy merge strategies", () => {
            const legacyStrategies = [
                "deep",
                "append",
                "prepend",
                "skip",
                "prompt",
                "directory",
                "import",
            ];
            for (const strategy of legacyStrategies) {
                expect(mergeStrategySchema.safeParse(strategy).success).toBe(false);
            }
        });
    });
});

describe("detectLegacyFields", () => {
    it("returns empty array for valid manifest", () => {
        expect(
            detectLegacyFields({ name: "test", version: "1.0.0", ai: { tools: ["*"] } }),
        ).toEqual([]);
    });

    it("returns empty array for null/non-object", () => {
        expect(detectLegacyFields(null)).toEqual([]);
        expect(detectLegacyFields("string")).toEqual([]);
    });

    it("detects ai.rules", () => {
        const errors = detectLegacyFields({ ai: { rules: ["rule1"] } });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain("ai.rules");
        expect(errors[0]).toContain("no longer supported");
    });

    it("detects ai.agents", () => {
        const errors = detectLegacyFields({ ai: { agents: ["agent1"] } });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain("ai.agents");
    });

    it("detects ai.skills", () => {
        const errors = detectLegacyFields({ ai: { skills: [{ name: "deploy" }] } });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain("ai.skills");
    });

    it("detects ai.memory", () => {
        const errors = detectLegacyFields({
            ai: { memory: [{ source: "MEMORY.md", merge: "append" }] },
        });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain("ai.memory");
    });

    it("detects ai.commands", () => {
        const errors = detectLegacyFields({ ai: { commands: ["build"] } });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain("ai.commands");
    });

    it("detects ai.mcp", () => {
        const errors = detectLegacyFields({ ai: { mcp: [{ name: "server" }] } });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain("ai.mcp");
    });

    it("detects top-level files", () => {
        const errors = detectLegacyFields({ files: [{ source: "biome.json" }] });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('"files"');
    });

    it("detects top-level ide", () => {
        const errors = detectLegacyFields({ ide: { vscode: ["settings.json"] } });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('"ide"');
    });

    it("detects multiple legacy fields at once", () => {
        const errors = detectLegacyFields({
            ai: { rules: ["r1"], memory: [{ source: "MEMORY.md", merge: "append" }] },
            files: [{ source: "f" }],
        });
        expect(errors).toHaveLength(3);
    });

    it("does not flag ai.tools (still valid)", () => {
        const errors = detectLegacyFields({ ai: { tools: ["claude-code"] } });
        expect(errors).toEqual([]);
    });
});
