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
    it("should join parts with concat strategy and normalize", () => {
        const parts = ["content A\n", "content B\n"];
        const result = mergeContentParts(parts, "concat");

        expect(result).not.toMatch(/\n{3,}/);
        expect(result).toContain("content A");
        expect(result).toContain("content B");
        expect(result.indexOf("content A")).toBeLessThan(result.indexOf("content B"));
        expect(result.endsWith("\n")).toBe(true);
    });

    it("should return last part for replace strategy", () => {
        const parts = ["first", "second"];
        expect(mergeContentParts(parts, "replace")).toBe("second");
    });

    it("should return last part for unknown strategy (default/replace)", () => {
        const parts = ["first", "second"];
        expect(mergeContentParts(parts, "unknown")).toBe("second");
    });

    it("should throw for legacy 'append' strategy", () => {
        const parts = ["first", "second"];
        expect(() => mergeContentParts(parts, "append")).toThrow(
            'Merge strategy "append" is no longer supported in v2',
        );
    });

    it("should throw for legacy 'prepend' strategy", () => {
        const parts = ["first", "second"];
        expect(() => mergeContentParts(parts, "prepend")).toThrow(
            'Merge strategy "prepend" is no longer supported in v2',
        );
    });

    it("should throw for legacy 'skip' strategy", () => {
        const parts = ["first", "second"];
        expect(() => mergeContentParts(parts, "skip")).toThrow(
            'Merge strategy "skip" is no longer supported in v2',
        );
    });

    it("should throw for legacy 'deep' strategy", () => {
        const parts = ["first", "second"];
        expect(() => mergeContentParts(parts, "deep")).toThrow(
            'Merge strategy "deep" is no longer supported in v2',
        );
    });

    it("should throw for legacy 'prompt' strategy", () => {
        expect(() => mergeContentParts(["a"], "prompt")).toThrow("no longer supported");
    });

    it("should throw for legacy 'directory' strategy", () => {
        expect(() => mergeContentParts(["a"], "directory")).toThrow("no longer supported");
    });

    it("should throw for legacy 'import' strategy", () => {
        expect(() => mergeContentParts(["a"], "import")).toThrow("no longer supported");
    });
});
