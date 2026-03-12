import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "./parser.js";

describe("parseFrontmatter", () => {
    it("parses merge and scope from frontmatter", () => {
        const input = "---\nmerge: replace\nscope: global\n---\n# Content";
        const result = parseFrontmatter(input);
        expect(result.batonMetadata).toEqual({ merge: "replace", scope: "global" });
        expect(result.contentStripped).toBe("# Content");
        expect(result.hasFrontmatter).toBe(true);
    });

    it("returns content unchanged when no frontmatter", () => {
        const input = "# No frontmatter here";
        const result = parseFrontmatter(input);
        expect(result.batonMetadata).toEqual({});
        expect(result.contentStripped).toBe(input);
        expect(result.hasFrontmatter).toBe(false);
    });

    it("selective strip preserves non-Baton keys for agents", () => {
        const input = "---\nname: Reviewer\nmodel: claude-sonnet-4-6\nscope: project\n---\n# Agent";
        const result = parseFrontmatter(input);
        expect(result.contentSelectiveStripped).toContain("name: Reviewer");
        expect(result.contentSelectiveStripped).toContain("model: claude-sonnet-4-6");
        expect(result.contentSelectiveStripped).not.toContain("scope: project");
        expect(result.contentSelectiveStripped).toContain("# Agent");
    });

    it("handles frontmatter with only Baton keys — selective strip removes entire block", () => {
        const input = "---\nscope: global\n---\n# Rule";
        const result = parseFrontmatter(input);
        expect(result.contentSelectiveStripped).toBe("# Rule");
    });

    it("handles empty frontmatter", () => {
        const input = "---\n---\n# Content";
        const result = parseFrontmatter(input);
        expect(result.batonMetadata).toEqual({});
        expect(result.contentStripped).toBe("# Content");
    });

    it("does not treat --- inside a value as closing delimiter", () => {
        const input = "---\ndescription: see README---\ntitle: Hello\n---\n# Content";
        const result = parseFrontmatter(input);
        expect(result.metadata).toHaveProperty("description", "see README---");
        expect(result.metadata).toHaveProperty("title", "Hello");
        expect(result.contentStripped).toBe("# Content");
    });

    it("handles frontmatter without trailing newline after closing ---", () => {
        const input = "---\nmerge: replace\n---";
        const result = parseFrontmatter(input);
        expect(result.hasFrontmatter).toBe(true);
        expect(result.batonMetadata.merge).toBe("replace");
        expect(result.contentStripped).toBe("");
    });

    it("does not treat --- in body as frontmatter", () => {
        const input = "# Title\n---\nNot frontmatter\n---";
        const result = parseFrontmatter(input);
        expect(result.hasFrontmatter).toBe(false);
        expect(result.contentStripped).toBe(input);
    });
});
