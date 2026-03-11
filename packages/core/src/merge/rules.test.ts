import { describe, expect, test } from "vitest";
import type { RuleEntry } from "./rules.js";
import { mergeRuleEntries } from "./rules.js";

describe("mergeRuleEntries", () => {
    test("returns empty array for empty input", () => {
        expect(mergeRuleEntries([])).toEqual([]);
    });

    test("returns all entries when no duplicates", () => {
        const entries: RuleEntry[] = [
            { name: "coding-standards", agents: [], scope: "project", profileName: "base" },
            { name: "security", agents: [], scope: "project", profileName: "base" },
        ];

        const result = mergeRuleEntries(entries);
        expect(result).toHaveLength(2);
        expect(result).toContainEqual(entries[0]);
        expect(result).toContainEqual(entries[1]);
    });

    test("last entry wins on name conflict (deduplication)", () => {
        const entries: RuleEntry[] = [
            { name: "coding-standards", agents: [], scope: "project", profileName: "base" },
            { name: "coding-standards", agents: [], scope: "global", profileName: "override" },
        ];

        const result = mergeRuleEntries(entries);
        expect(result).toHaveLength(1);
        expect(result[0].profileName).toBe("override");
        expect(result[0].scope).toBe("global");
    });

    test("preserves non-conflicting entries from multiple profiles", () => {
        const entries: RuleEntry[] = [
            { name: "security", agents: [], scope: "project", profileName: "base" },
            { name: "formatting", agents: [], scope: "project", profileName: "override" },
        ];

        const result = mergeRuleEntries(entries);
        expect(result).toHaveLength(2);
    });

    test("preserves subdirectory structure in rule names", () => {
        const entries: RuleEntry[] = [
            { name: "frontend/react", agents: [], scope: "project", profileName: "base" },
            { name: "backend/api", agents: [], scope: "project", profileName: "base" },
        ];

        const result = mergeRuleEntries(entries);
        expect(result).toHaveLength(2);
        expect(result.some((r) => r.name === "frontend/react")).toBe(true);
        expect(result.some((r) => r.name === "backend/api")).toBe(true);
    });

    test("agents field is always empty in v2 entries", () => {
        const entries: RuleEntry[] = [
            { name: "rule-a", agents: [], scope: "project", profileName: "base" },
        ];

        const result = mergeRuleEntries(entries);
        expect(result[0].agents).toEqual([]);
    });

    test("rules from global-scope profile keep scope global", () => {
        const entries: RuleEntry[] = [
            {
                name: "coding-standards",
                agents: [],
                scope: "global",
                profileName: "global-profile",
            },
        ];

        const result = mergeRuleEntries(entries);
        expect(result[0].scope).toBe("global");
    });
});
