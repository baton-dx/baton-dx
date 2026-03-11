import { describe, expect, it } from "vitest";
import type { MergedSkillItem } from "./skills.js";
import { mergeSkillEntries } from "./skills.js";

describe("mergeSkillEntries", () => {
    it("returns empty array for empty input", () => {
        expect(mergeSkillEntries([])).toEqual([]);
    });

    it("returns all entries when no duplicates", () => {
        const entries: MergedSkillItem[] = [
            { name: "code-review", scope: "project", profileName: "base" },
            { name: "test-gen", scope: "project", profileName: "base" },
        ];

        const result = mergeSkillEntries(entries);
        expect(result).toHaveLength(2);
        expect(result.map((s) => s.name)).toContain("code-review");
        expect(result.map((s) => s.name)).toContain("test-gen");
    });

    it("last entry wins on name conflict", () => {
        const entries: MergedSkillItem[] = [
            { name: "code-review", scope: "global", profileName: "base" },
            { name: "code-review", scope: "project", profileName: "child" },
        ];

        const result = mergeSkillEntries(entries);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ name: "code-review", scope: "project", profileName: "child" });
    });

    it("three profiles with overlapping skill names", () => {
        const entries: MergedSkillItem[] = [
            { name: "code-review", scope: "global", profileName: "base" },
            { name: "code-review", scope: "project", profileName: "middle" },
            { name: "code-review", scope: "project", profileName: "top" },
        ];

        const result = mergeSkillEntries(entries);
        expect(result).toHaveLength(1);
        expect(result[0].profileName).toBe("top");
    });

    it("deduplicates skills while keeping non-conflicting entries", () => {
        const entries: MergedSkillItem[] = [
            { name: "code-review", scope: "project", profileName: "base" },
            { name: "test-gen", scope: "project", profileName: "base" },
            { name: "code-review", scope: "global", profileName: "child" },
            { name: "pr-summary", scope: "project", profileName: "child" },
        ];

        const result = mergeSkillEntries(entries);
        expect(result).toHaveLength(3);
        expect(result.map((s) => s.name)).toContain("code-review");
        expect(result.map((s) => s.name)).toContain("test-gen");
        expect(result.map((s) => s.name)).toContain("pr-summary");

        const codeReview = result.find((s) => s.name === "code-review");
        expect(codeReview?.scope).toBe("global");
        expect(codeReview?.profileName).toBe("child");
    });

    it("skill inherits scope from profile", () => {
        const entries: MergedSkillItem[] = [
            { name: "code-review", scope: "global", profileName: "global-profile" },
        ];

        const result = mergeSkillEntries(entries);
        expect(result[0].scope).toBe("global");
    });
});
