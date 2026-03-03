import { describe, expect, it } from "vitest";
import { mergeContentParts, normalizeMarkdown } from "./content-parts";

describe("normalizeMarkdown", () => {
    it("should collapse 3+ consecutive newlines to exactly 2", () => {
        expect(normalizeMarkdown("a\n\n\nb")).toBe("a\n\nb\n");
        expect(normalizeMarkdown("a\n\n\n\nb")).toBe("a\n\nb\n");
        expect(normalizeMarkdown("a\n\n\n\n\nb")).toBe("a\n\nb\n");
    });

    it("should preserve single blank lines (2 consecutive newlines)", () => {
        expect(normalizeMarkdown("a\n\nb")).toBe("a\n\nb\n");
    });

    it("should ensure a single trailing newline", () => {
        expect(normalizeMarkdown("content")).toBe("content\n");
        expect(normalizeMarkdown("content\n")).toBe("content\n");
        expect(normalizeMarkdown("content\n\n")).toBe("content\n");
        expect(normalizeMarkdown("content\n\n\n")).toBe("content\n");
    });

    it("should be idempotent", () => {
        const input = "a\n\n\n\nb\n\n\nc\n\n\n";
        const once = normalizeMarkdown(input);
        const twice = normalizeMarkdown(once);
        expect(twice).toBe(once);
    });

    it("should handle content parts that end with newlines joined by \\n\\n", () => {
        // This is the real-world scenario: parts ending with \n joined by \n\n
        const part1 = "# Memory from profile A\nSome content\n";
        const part2 = "# Memory from profile B\nMore content\n";
        const joined = `${part1}\n\n${part2}`;

        // Without normalization: part1\n + \n\n + part2 = 3 consecutive newlines
        expect(joined).toContain("\n\n\n");

        // After normalization: max 1 blank line between sections
        const result = normalizeMarkdown(joined);
        expect(result).not.toMatch(/\n{3,}/);
        expect(result).toContain("# Memory from profile A");
        expect(result).toContain("# Memory from profile B");
        expect(result.endsWith("\n")).toBe(true);
    });

    it("should handle empty string", () => {
        expect(normalizeMarkdown("")).toBe("\n");
    });
});

describe("mergeContentParts", () => {
    it("should join parts with append strategy and normalize", () => {
        const parts = ["content A\n", "content B\n"];
        const result = mergeContentParts(parts, "append");

        expect(result).not.toMatch(/\n{3,}/);
        expect(result).toContain("content A");
        expect(result).toContain("content B");
        expect(result.indexOf("content A")).toBeLessThan(result.indexOf("content B"));
        expect(result.endsWith("\n")).toBe(true);
    });

    it("should join parts with prepend strategy (reversed) and normalize", () => {
        const parts = ["content A\n", "content B\n"];
        const result = mergeContentParts(parts, "prepend");

        expect(result).not.toMatch(/\n{3,}/);
        expect(result).toContain("content A");
        expect(result).toContain("content B");
        expect(result.indexOf("content B")).toBeLessThan(result.indexOf("content A"));
        expect(result.endsWith("\n")).toBe(true);
    });

    it("should return first part for skip strategy", () => {
        const parts = ["first", "second"];
        expect(mergeContentParts(parts, "skip")).toBe("first");
    });

    it("should return last part for replace strategy", () => {
        const parts = ["first", "second"];
        expect(mergeContentParts(parts, "replace")).toBe("second");
    });

    it("should return last part for unknown strategy (default)", () => {
        const parts = ["first", "second"];
        expect(mergeContentParts(parts, "unknown")).toBe("second");
    });
});
