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
        const part1 = "# Memory from profile A\nSome content\n";
        const part2 = "# Memory from profile B\nMore content\n";
        const joined = `${part1}\n\n${part2}`;

        expect(joined).toContain("\n\n\n");

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
    it("concat strategy joins parts in order", () => {
        const parts = ["content A\n", "content B\n"];
        const result = mergeContentParts(parts, "concat");

        expect(result).not.toMatch(/\n{3,}/);
        expect(result).toContain("content A");
        expect(result).toContain("content B");
        expect(result.indexOf("content A")).toBeLessThan(result.indexOf("content B"));
        expect(result.endsWith("\n")).toBe(true);
    });

    it("replace strategy returns last part", () => {
        const parts = ["first", "second"];
        expect(mergeContentParts(parts, "replace")).toBe("second");
    });

    it("unknown strategy falls back to concat", () => {
        const parts = ["first\n", "second\n"];
        const result = mergeContentParts(parts, "unknown");
        expect(result).toContain("first");
        expect(result).toContain("second");
    });
});
