import { describe, expect, test } from "vitest";
import type { ResolvedProfile } from "../inheritance/profile-chain.js";
import type { ProfileManifest } from "../schemas/profile-manifest.js";
import { mergeAgents, mergeAgentsWithWarnings } from "./agents.js";
import { sortProfilesByWeight } from "./weight-sort.js";

describe("mergeAgents", () => {
    test("merges universal agents from array format", () => {
        const profiles: ResolvedProfile[] = [
            {
                source: "./base",
                name: "base",
                manifest: {
                    name: "base",
                    version: "1.0.0",
                    ai: {
                        agents: ["code-reviewer", "test-writer"],
                    },
                } as ProfileManifest,
            },
        ];

        const result = mergeAgents(profiles);

        expect(result).toHaveLength(2);
        expect(result).toContainEqual({
            name: "code-reviewer",
            agents: [],
            scope: "project",
            profileName: "base",
        });
        expect(result).toContainEqual({
            name: "test-writer",
            agents: [],
            scope: "project",
            profileName: "base",
        });
    });

    test("merges tool-specific agents from object format", () => {
        const profiles: ResolvedProfile[] = [
            {
                source: "./base",
                name: "base",
                manifest: {
                    name: "base",
                    version: "1.0.0",
                    ai: {
                        agents: {
                            "claude-code": ["code-reviewer"],
                            cursor: ["cursor-agent"],
                        },
                    },
                } as ProfileManifest,
            },
        ];

        const result = mergeAgents(profiles);

        expect(result).toHaveLength(2);
        expect(result).toContainEqual({
            name: "code-reviewer",
            agents: ["claude-code"],
            scope: "project",
            profileName: "base",
        });
        expect(result).toContainEqual({
            name: "cursor-agent",
            agents: ["cursor"],
            scope: "project",
            profileName: "base",
        });
    });

    test("merges universal agents from object format with 'universal' key", () => {
        const profiles: ResolvedProfile[] = [
            {
                source: "./base",
                name: "base",
                manifest: {
                    name: "base",
                    version: "1.0.0",
                    ai: {
                        agents: {
                            universal: ["shared-agent"],
                        },
                    },
                } as ProfileManifest,
            },
        ];

        const result = mergeAgents(profiles);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            name: "shared-agent",
            agents: [],
            scope: "project",
            profileName: "base",
        });
    });

    test("later profile wins on name conflict (last-wins)", () => {
        const profiles: ResolvedProfile[] = [
            {
                source: "./base",
                name: "base",
                manifest: {
                    name: "base",
                    version: "1.0.0",
                    ai: {
                        agents: ["code-reviewer"],
                    },
                } as ProfileManifest,
            },
            {
                source: "./override",
                name: "override",
                manifest: {
                    name: "override",
                    version: "1.0.0",
                    ai: {
                        agents: ["code-reviewer"],
                    },
                } as ProfileManifest,
            },
        ];

        const result = mergeAgents(profiles);

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("code-reviewer");
        expect(result[0].profileName).toBe("override");
    });

    test("allows same agent name for different tool scopes", () => {
        const profiles: ResolvedProfile[] = [
            {
                source: "./base",
                name: "base",
                manifest: {
                    name: "base",
                    version: "1.0.0",
                    ai: {
                        agents: {
                            "claude-code": ["reviewer"],
                            cursor: ["reviewer"],
                            universal: ["reviewer"],
                        },
                    },
                } as ProfileManifest,
            },
        ];

        const result = mergeAgents(profiles);

        expect(result).toHaveLength(3);
        expect(result.filter((a) => a.name === "reviewer")).toHaveLength(3);
    });

    test("higher-weight profile wins on conflict when pre-sorted", () => {
        const profiles: ResolvedProfile[] = [
            {
                source: "./low",
                name: "low-weight",
                manifest: {
                    name: "low-weight",
                    version: "1.0.0",
                    weight: 1,
                    ai: {
                        agents: ["code-reviewer"],
                    },
                } as ProfileManifest,
            },
            {
                source: "./high",
                name: "high-weight",
                manifest: {
                    name: "high-weight",
                    version: "1.0.0",
                    weight: 10,
                    ai: {
                        agents: ["code-reviewer"],
                    },
                } as ProfileManifest,
            },
        ];

        const sorted = sortProfilesByWeight(profiles);
        const result = mergeAgents(sorted);

        expect(result).toHaveLength(1);
        expect(result[0].profileName).toBe("high-weight");
    });

    test("locked profile (weight -1) agent cannot be overridden", () => {
        const profiles: ResolvedProfile[] = [
            {
                source: "./locked",
                name: "locked",
                manifest: {
                    name: "locked",
                    version: "1.0.0",
                    weight: -1,
                    ai: {
                        agents: ["code-reviewer"],
                    },
                } as ProfileManifest,
            },
            {
                source: "./high",
                name: "high-weight",
                manifest: {
                    name: "high-weight",
                    version: "1.0.0",
                    weight: 100,
                    ai: {
                        agents: ["code-reviewer"],
                    },
                } as ProfileManifest,
            },
        ];

        const sorted = sortProfilesByWeight(profiles);
        const result = mergeAgents(sorted);

        expect(result).toHaveLength(1);
        expect(result[0].profileName).toBe("locked");
    });

    test("emits warning when same-weight profiles define the same agent", () => {
        const profiles: ResolvedProfile[] = [
            {
                source: "./team-a",
                name: "team-a",
                manifest: {
                    name: "team-a",
                    version: "1.0.0",
                    weight: 5,
                    ai: {
                        agents: ["code-reviewer"],
                    },
                } as ProfileManifest,
            },
            {
                source: "./team-b",
                name: "team-b",
                manifest: {
                    name: "team-b",
                    version: "1.0.0",
                    weight: 5,
                    ai: {
                        agents: ["code-reviewer"],
                    },
                } as ProfileManifest,
            },
        ];

        const sorted = sortProfilesByWeight(profiles);
        const result = mergeAgentsWithWarnings(sorted);

        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0].key).toBe("code-reviewer");
        expect(result.warnings[0].category).toBe("agent");
        expect(result.warnings[0].profileA).toBe("team-a");
        expect(result.warnings[0].profileB).toBe("team-b");
        expect(result.warnings[0].weight).toBe(5);
    });

    test("handles empty agents array", () => {
        const profiles: ResolvedProfile[] = [
            {
                source: "./base",
                name: "base",
                manifest: {
                    name: "base",
                    version: "1.0.0",
                    ai: {
                        agents: [],
                    },
                } as ProfileManifest,
            },
        ];

        const result = mergeAgents(profiles);

        expect(result).toHaveLength(0);
    });

    test("handles profiles without agents section", () => {
        const profiles: ResolvedProfile[] = [
            {
                source: "./base",
                name: "base",
                manifest: {
                    name: "base",
                    version: "1.0.0",
                    ai: {
                        rules: ["some-rule.md"],
                    },
                } as ProfileManifest,
            },
        ];

        const result = mergeAgents(profiles);

        expect(result).toHaveLength(0);
    });

    test("handles profiles without ai section", () => {
        const profiles: ResolvedProfile[] = [
            {
                source: "./base",
                name: "base",
                manifest: {
                    name: "base",
                    version: "1.0.0",
                } as ProfileManifest,
            },
        ];

        const result = mergeAgents(profiles);

        expect(result).toHaveLength(0);
    });

    test("agents from profile with scope 'global' get scope 'global'", () => {
        const profiles: ResolvedProfile[] = [
            {
                source: "./global-profile",
                name: "global-profile",
                manifest: {
                    name: "global-profile",
                    version: "1.0.0",
                    scope: "global",
                    ai: {
                        agents: ["code-reviewer"],
                    },
                } as ProfileManifest,
            },
        ];

        const result = mergeAgents(profiles);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            name: "code-reviewer",
            agents: [],
            scope: "global",
            profileName: "global-profile",
        });
    });
});
