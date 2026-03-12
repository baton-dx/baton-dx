import { describe, expect, it } from "vitest";
import type { MemoryContribution, MemoryEntry } from "./memory.js";

describe("MemoryEntry types", () => {
    it("MemoryEntry has the expected shape", () => {
        const entry: MemoryEntry = {
            filename: "MEMORY.md",
            mergeStrategy: "concat",
            scope: "project",
            contributions: [{ profileName: "base", mergeStrategy: "concat" }],
        };

        expect(entry.filename).toBe("MEMORY.md");
        expect(entry.mergeStrategy).toBe("concat");
        expect(entry.scope).toBe("project");
        expect(entry.contributions).toHaveLength(1);
    });

    it("MemoryContribution has profileName and mergeStrategy", () => {
        const contribution: MemoryContribution = {
            profileName: "my-profile",
            mergeStrategy: "replace",
        };

        expect(contribution.profileName).toBe("my-profile");
        expect(contribution.mergeStrategy).toBe("replace");
    });

    it("supports multiple contributions from inheritance chain", () => {
        const entry: MemoryEntry = {
            filename: "MEMORY.md",
            mergeStrategy: "concat",
            scope: "project",
            contributions: [
                { profileName: "base", mergeStrategy: "concat" },
                { profileName: "middle", mergeStrategy: "concat" },
                { profileName: "top", mergeStrategy: "replace" },
            ],
        };

        expect(entry.contributions).toHaveLength(3);
        expect(entry.contributions[0].profileName).toBe("base");
        expect(entry.contributions[2].profileName).toBe("top");
    });

    it("supports global scope", () => {
        const entry: MemoryEntry = {
            filename: "MEMORY.md",
            mergeStrategy: "concat",
            scope: "global",
            contributions: [{ profileName: "global-profile", mergeStrategy: "concat" }],
        };

        expect(entry.scope).toBe("global");
    });

    it("supports replace merge strategy", () => {
        const entry: MemoryEntry = {
            filename: "MEMORY.md",
            mergeStrategy: "replace",
            scope: "project",
            contributions: [{ profileName: "base", mergeStrategy: "replace" }],
        };

        expect(entry.mergeStrategy).toBe("replace");
    });
});
