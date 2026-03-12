import { describe, expect, it } from "vitest";
import { mergeReplace } from "./strategies";

describe("mergeReplace", () => {
    it("should replace target with source", () => {
        const source = "new content";
        const target = "old content";
        expect(mergeReplace(source, target)).toBe(source);
    });

    it("should work with empty target", () => {
        const source = "new content";
        const target = "";
        expect(mergeReplace(source, target)).toBe(source);
    });
});
