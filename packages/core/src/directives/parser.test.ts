import { describe, expect, it } from "vitest";
import { parseDirectives } from "./parser.js";

describe("parseDirectives", () => {
    it("parses baton:include with src only", () => {
        const result = parseDirectives('<!-- baton:include src="PROJECT.md" -->');
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe("include");
        expect(result[0].attributes).toEqual({ src: "PROJECT.md" });
    });

    it("parses baton:include with all attributes", () => {
        const result = parseDirectives(
            '<!-- baton:include src="docs/api.md" mode="reference" optional="true" -->',
        );
        expect(result).toHaveLength(1);
        expect(result[0].attributes).toEqual({
            src: "docs/api.md",
            mode: "reference",
            optional: "true",
        });
    });

    it("parses baton:if with tool condition", () => {
        const result = parseDirectives('<!-- baton:if tool="claude-code" -->');
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe("if");
        expect(result[0].attributes).toEqual({ tool: "claude-code" });
    });

    it("parses baton:if with not-tool condition", () => {
        const result = parseDirectives('<!-- baton:if not-tool="claude-code" -->');
        expect(result).toHaveLength(1);
        expect(result[0].attributes).toEqual({ "not-tool": "claude-code" });
    });

    it("parses baton:if with ide condition", () => {
        const result = parseDirectives('<!-- baton:if ide="vscode" -->');
        expect(result[0].attributes).toEqual({ ide: "vscode" });
    });

    it("parses baton:if with not-ide condition", () => {
        const result = parseDirectives('<!-- baton:if not-ide="jetbrains" -->');
        expect(result[0].attributes).toEqual({ "not-ide": "jetbrains" });
    });

    it("parses baton:if with scope condition", () => {
        const result = parseDirectives('<!-- baton:if scope="project" -->');
        expect(result[0].attributes).toEqual({ scope: "project" });
    });

    it("parses baton:if with type condition", () => {
        const result = parseDirectives('<!-- baton:if type="memory" -->');
        expect(result[0].attributes).toEqual({ type: "memory" });
    });

    it("parses baton:endif", () => {
        const result = parseDirectives("<!-- baton:endif -->");
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe("endif");
        expect(result[0].attributes).toEqual({});
    });

    it("parses multiple directives in one document", () => {
        const content = [
            "# Header",
            '<!-- baton:if tool="claude-code" -->',
            "Claude specific",
            "<!-- baton:endif -->",
            '<!-- baton:include src="PROJECT.md" -->',
        ].join("\n");
        const result = parseDirectives(content);
        expect(result).toHaveLength(3);
        expect(result[0].type).toBe("if");
        expect(result[1].type).toBe("endif");
        expect(result[2].type).toBe("include");
    });

    it("ignores regular HTML comments", () => {
        const result = parseDirectives("<!-- This is a regular comment -->");
        expect(result).toHaveLength(0);
    });

    it("ignores unknown baton directive types", () => {
        const result = parseDirectives('<!-- baton:define name="foo" -->');
        expect(result).toHaveLength(0);
    });

    it("ignores malformed directives (missing quotes)", () => {
        // Unquoted attributes don't match the directive regex at all
        const result = parseDirectives("<!-- baton:include src=PROJECT.md -->");
        expect(result).toHaveLength(0);
    });

    it("records correct startIndex and endIndex", () => {
        const prefix = "Hello\n";
        const directive = '<!-- baton:include src="file.md" -->';
        const content = `${prefix}${directive}\nMore text`;
        const result = parseDirectives(content);
        expect(result).toHaveLength(1);
        expect(result[0].startIndex).toBe(prefix.length);
        expect(result[0].endIndex).toBe(prefix.length + directive.length);
        expect(result[0].raw).toBe(directive);
    });

    it("returns empty array for content without directives", () => {
        expect(parseDirectives("Just some markdown\n# Heading")).toHaveLength(0);
    });

    it("handles extra whitespace in directive", () => {
        const result = parseDirectives('<!--   baton:include   src="file.md"   -->');
        expect(result).toHaveLength(1);
        expect(result[0].attributes.src).toBe("file.md");
    });

    it("parses comma-separated tool values", () => {
        const result = parseDirectives('<!-- baton:if tool="cursor,windsurf" -->');
        expect(result[0].attributes.tool).toBe("cursor,windsurf");
    });
});
