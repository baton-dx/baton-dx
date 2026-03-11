import { describe, expect, test } from "vitest";
import type { AgentEntry } from "./agents.js";
import { mergeAgentEntries } from "./agents.js";

describe("mergeAgentEntries", () => {
    test("returns empty array for empty input", () => {
        expect(mergeAgentEntries([])).toEqual([]);
    });

    test("returns all entries when no duplicates", () => {
        const entries: AgentEntry[] = [
            { name: "code-reviewer", agents: [], scope: "project", profileName: "base" },
            { name: "test-writer", agents: [], scope: "project", profileName: "base" },
        ];

        const result = mergeAgentEntries(entries);
        expect(result).toHaveLength(2);
        expect(result).toContainEqual(entries[0]);
        expect(result).toContainEqual(entries[1]);
    });

    test("last entry wins on name conflict (deduplication)", () => {
        const entries: AgentEntry[] = [
            { name: "code-reviewer", agents: [], scope: "project", profileName: "base" },
            { name: "code-reviewer", agents: [], scope: "global", profileName: "override" },
        ];

        const result = mergeAgentEntries(entries);
        expect(result).toHaveLength(1);
        expect(result[0].profileName).toBe("override");
        expect(result[0].scope).toBe("global");
    });

    test("preserves non-conflicting entries from multiple profiles", () => {
        const entries: AgentEntry[] = [
            { name: "reviewer", agents: [], scope: "project", profileName: "base" },
            { name: "deployer", agents: [], scope: "project", profileName: "override" },
        ];

        const result = mergeAgentEntries(entries);
        expect(result).toHaveLength(2);
    });

    test("agents field is always empty in v2 entries", () => {
        const entries: AgentEntry[] = [
            { name: "agent-a", agents: [], scope: "project", profileName: "base" },
        ];

        const result = mergeAgentEntries(entries);
        expect(result[0].agents).toEqual([]);
    });

    test("agents from global-scope profile keep scope global", () => {
        const entries: AgentEntry[] = [
            { name: "code-reviewer", agents: [], scope: "global", profileName: "global-profile" },
        ];

        const result = mergeAgentEntries(entries);
        expect(result[0].scope).toBe("global");
    });
});
