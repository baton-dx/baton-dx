import { describe, expect, it } from "vitest";
import { projectManifestSchema } from "./project-manifest.js";

describe("Schema Validation - Project Manifest", () => {
    describe("Valid manifests", () => {
        it("validates minimal project manifest with one profile", () => {
            const result = projectManifestSchema.safeParse({
                profiles: [{ source: "github:org/profile" }],
            });

            expect(result.success).toBe(true);
        });

        it("validates project manifest with version pinning", () => {
            const result = projectManifestSchema.safeParse({
                profiles: [{ source: "github:org/profile", version: "1.2.3" }],
            });

            expect(result.success).toBe(true);
        });

        it("validates project manifest with extras", () => {
            const result = projectManifestSchema.safeParse({
                profiles: [{ source: "github:org/profile" }],
                extras: {
                    skills: [{ source: "./local/skill", scope: "project" }],
                    agents: [{ source: "github:org/agent", scope: "global" }],
                },
            });

            expect(result.success).toBe(true);
        });

        it("validates project manifest with overrides", () => {
            const result = projectManifestSchema.safeParse({
                profiles: [{ source: "github:org/profile" }],
                overrides: {
                    ai: {
                        memory: {
                            "CLAUDE.md": "replace",
                        },
                    },
                    files: {
                        "biome.json": { merge: "deep" },
                    },
                },
            });

            expect(result.success).toBe(true);
        });

        it("validates project manifest with variables", () => {
            const result = projectManifestSchema.safeParse({
                profiles: [{ source: "github:org/profile" }],
                variables: {
                    PROJECT_NAME: "my-app",
                    ENV: "production",
                },
            });

            expect(result.success).toBe(true);
        });
    });

    describe("US-011: baton.yaml has no tool/IDE fields", () => {
        it("does not include ai.tools or ide.platforms in schema shape", () => {
            // baton.yaml must only have: profiles, extras, overrides, variables
            const shape = projectManifestSchema.shape;
            const keys = Object.keys(shape);
            expect(keys).toContain("profiles");
            expect(keys).toContain("extras");
            expect(keys).toContain("overrides");
            expect(keys).toContain("variables");
            expect(keys).not.toContain("ai");
            expect(keys).not.toContain("ide");
            expect(keys).not.toContain("tools");
            expect(keys).not.toContain("target_agents");
        });

        it("strips unknown fields like target_agents from parsed output", () => {
            const result = projectManifestSchema.safeParse({
                profiles: [{ source: "github:org/profile" }],
                target_agents: ["claude-code", "cursor"],
                ai: { tools: ["claude-code"] },
            });

            // Zod strips unknown fields by default
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).not.toHaveProperty("target_agents");
                expect(result.data).not.toHaveProperty("ai");
                expect(result.data.profiles).toHaveLength(1);
            }
        });

        it("produces a manifest with only profiles, extras, overrides, variables", () => {
            const result = projectManifestSchema.safeParse({
                profiles: [{ source: "github:org/profile" }],
                variables: { PROJECT: "test" },
            });

            expect(result.success).toBe(true);
            if (result.success) {
                const keys = Object.keys(result.data);
                // Only known keys should be present (Zod strips undefined optionals)
                for (const key of keys) {
                    expect(["profiles", "extras", "overrides", "variables"]).toContain(key);
                }
            }
        });
    });

    describe("Invalid manifests", () => {
        it("allows empty profiles array (optional profiles)", () => {
            const result = projectManifestSchema.safeParse({
                profiles: [],
            });

            // Empty profiles array is valid - projects can have no profiles
            expect(result.success).toBe(true);
        });

        it("rejects missing profiles field", () => {
            const result = projectManifestSchema.safeParse({
                variables: { TEST: "value" },
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].path).toContain("profiles");
            }
        });

        it("rejects profile without source", () => {
            const result = projectManifestSchema.safeParse({
                profiles: [{ version: "1.0.0" }],
            });

            expect(result.success).toBe(false);
        });

        it("rejects invalid scope in extras", () => {
            const result = projectManifestSchema.safeParse({
                profiles: [{ source: "github:org/profile" }],
                extras: {
                    skills: [{ source: "./local/skill", scope: "invalid" }],
                },
            });

            expect(result.success).toBe(false);
        });

        it("provides error path for nested invalid fields", () => {
            const result = projectManifestSchema.safeParse({
                profiles: [{ source: "github:org/profile" }],
                extras: {
                    skills: [{ source: 123, scope: "project" }],
                },
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                const errorPath = result.error.issues[0].path.join(".");
                expect(errorPath).toContain("extras");
                expect(errorPath).toContain("skills");
            }
        });
    });
});
