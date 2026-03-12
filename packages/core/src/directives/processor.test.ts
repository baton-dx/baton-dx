import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { processDirectives } from "./processor.js";
import type { DirectiveContext, DirectiveOptions, FilePlacement } from "./types.js";

function makeContext(overrides: Partial<DirectiveContext> = {}): DirectiveContext {
    return {
        projectRoot: "/tmp/test",
        currentTool: "claude-code",
        detectedTools: ["claude-code", "cursor"],
        detectedIdes: ["vscode"],
        scope: "project",
        contentType: "memory",
        ...overrides,
    };
}

function makeOptions(
    contextOverrides: Partial<DirectiveContext> = {},
    onWarning?: (msg: string) => void,
): DirectiveOptions {
    return { context: makeContext(contextOverrides), onWarning };
}

describe("processDirectives", () => {
    let projectRoot: string;

    beforeEach(async () => {
        projectRoot = join(tmpdir(), `baton-processor-test-${Date.now()}`);
        await mkdir(projectRoot, { recursive: true });
    });

    afterEach(async () => {
        await rm(projectRoot, { recursive: true, force: true });
    });

    it("passes through content without directives (fast path)", async () => {
        const content = "# Hello\nJust markdown.";
        const result = await processDirectives(content, makeOptions());
        expect(result).toBe(content);
    });

    it("passes through empty content", async () => {
        const result = await processDirectives("", makeOptions());
        expect(result).toBe("");
    });

    it("resolves a simple conditional — keep", async () => {
        const content = [
            "Before",
            '<!-- baton:if tool="claude-code" -->',
            "Claude only",
            "<!-- baton:endif -->",
            "After",
        ].join("\n");
        const result = await processDirectives(content, makeOptions());
        expect(result).toContain("Claude only");
        expect(result).toContain("Before");
        expect(result).toContain("After");
        expect(result).not.toContain("baton:if");
        expect(result).not.toContain("baton:endif");
    });

    it("resolves a simple conditional — remove", async () => {
        const content = [
            "Before",
            '<!-- baton:if tool="cursor" -->',
            "Cursor only",
            "<!-- baton:endif -->",
            "After",
        ].join("\n");
        const result = await processDirectives(content, makeOptions());
        expect(result).not.toContain("Cursor only");
        expect(result).toContain("Before");
        expect(result).toContain("After");
    });

    it("resolves nested conditionals (2 levels)", async () => {
        const content = [
            '<!-- baton:if tool="claude-code" -->',
            "Outer",
            '<!-- baton:if scope="project" -->',
            "Inner",
            "<!-- baton:endif -->",
            "<!-- baton:endif -->",
        ].join("\n");
        const result = await processDirectives(content, makeOptions({ projectRoot }));
        expect(result).toContain("Outer");
        expect(result).toContain("Inner");
    });

    it("resolves nested conditionals — inner removed", async () => {
        const content = [
            '<!-- baton:if tool="claude-code" -->',
            "Outer",
            '<!-- baton:if scope="global" -->',
            "Inner (should be removed)",
            "<!-- baton:endif -->",
            "<!-- baton:endif -->",
        ].join("\n");
        const result = await processDirectives(content, makeOptions({ projectRoot }));
        expect(result).toContain("Outer");
        expect(result).not.toContain("Inner");
    });

    it("resolves include with merge mode", async () => {
        await writeFile(join(projectRoot, "PROJECT.md"), "Project content");
        const content = '<!-- baton:include src="PROJECT.md" -->';
        const result = await processDirectives(content, makeOptions({ projectRoot }));
        expect(result).toBe("Project content");
    });

    it("conditionals evaluated before includes — excluded includes not read", async () => {
        // PROJECT.md does NOT exist — but the include is inside an excluded conditional
        const content = [
            '<!-- baton:if tool="cursor" -->',
            '<!-- baton:include src="PROJECT.md" -->',
            "<!-- baton:endif -->",
        ].join("\n");
        // Should not warn about missing file because the block is excluded
        const warn = vi.fn();
        const result = await processDirectives(content, makeOptions({ projectRoot }, warn));
        expect(result).not.toContain("PROJECT.md");
        expect(warn).not.toHaveBeenCalled();
    });

    it("mixed includes and conditionals", async () => {
        await writeFile(join(projectRoot, "extra.md"), "Extra content");
        const content = [
            "# Header",
            '<!-- baton:if tool="claude-code" -->',
            "Claude section",
            "<!-- baton:endif -->",
            '<!-- baton:include src="extra.md" -->',
        ].join("\n");
        const result = await processDirectives(content, makeOptions({ projectRoot }));
        expect(result).toContain("# Header");
        expect(result).toContain("Claude section");
        expect(result).toContain("Extra content");
    });

    it("unmatched baton:if → content kept (fail-open)", async () => {
        const warn = vi.fn();
        const content = ['<!-- baton:if tool="claude-code" -->', "Kept content"].join("\n");
        const result = await processDirectives(content, makeOptions({ projectRoot }, warn));
        expect(result).toContain("Kept content");
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("Unmatched baton:if"));
    });

    it("unmatched baton:endif → warning emitted, tag cleaned from output", async () => {
        const warn = vi.fn();
        const content = "<!-- baton:endif -->";
        const result = await processDirectives(content, makeOptions({ projectRoot }, warn));
        expect(result).not.toContain("baton:endif");
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("Unmatched baton:endif"));
    });

    it("cleanup removes all remaining baton:* comments from output", async () => {
        const content = [
            "Before",
            "<!-- baton:endif -->",
            "Middle",
            '<!-- baton:unknown foo="bar" -->',
            "After",
        ].join("\n");
        const warn = vi.fn();
        const result = await processDirectives(content, makeOptions({ projectRoot }, warn));
        expect(result).not.toContain("baton:");
        expect(result).toContain("Before");
        expect(result).toContain("Middle");
        expect(result).toContain("After");
    });

    it("not-tool conditional", async () => {
        const content = [
            '<!-- baton:if not-tool="claude-code" -->',
            "Not for Claude",
            "<!-- baton:endif -->",
        ].join("\n");
        const result = await processDirectives(content, makeOptions());
        expect(result).not.toContain("Not for Claude");
    });

    it("ide conditional", async () => {
        const content = [
            '<!-- baton:if ide="vscode" -->',
            "VS Code content",
            "<!-- baton:endif -->",
        ].join("\n");
        const result = await processDirectives(content, makeOptions());
        expect(result).toContain("VS Code content");
    });

    it("type conditional", async () => {
        const content = [
            '<!-- baton:if type="rules" -->',
            "Rules only",
            "<!-- baton:endif -->",
        ].join("\n");
        const result = await processDirectives(content, makeOptions({ contentType: "memory" }));
        expect(result).not.toContain("Rules only");
    });

    it("baton:else — condition true keeps if-branch", async () => {
        const content = [
            '<!-- baton:if tool="claude-code" -->',
            "Use @file for context.",
            "<!-- baton:else -->",
            "Use file paths for context.",
            "<!-- baton:endif -->",
        ].join("\n");
        const result = await processDirectives(content, makeOptions({ projectRoot }));
        expect(result).toContain("Use @file for context.");
        expect(result).not.toContain("Use file paths for context.");
    });

    it("baton:else — condition false keeps else-branch", async () => {
        const content = [
            '<!-- baton:if tool="cursor" -->',
            "Cursor-specific.",
            "<!-- baton:else -->",
            "Generic fallback.",
            "<!-- baton:endif -->",
        ].join("\n");
        const result = await processDirectives(content, makeOptions({ projectRoot }));
        expect(result).not.toContain("Cursor-specific.");
        expect(result).toContain("Generic fallback.");
    });

    it("baton:else with nested conditionals", async () => {
        const content = [
            '<!-- baton:if tool="cursor" -->',
            "Cursor content",
            "<!-- baton:else -->",
            '<!-- baton:if scope="project" -->',
            "Project fallback",
            "<!-- baton:endif -->",
            "<!-- baton:endif -->",
        ].join("\n");
        const result = await processDirectives(content, makeOptions({ projectRoot }));
        expect(result).not.toContain("Cursor content");
        expect(result).toContain("Project fallback");
    });

    it("deeply nested conditionals (5 levels)", async () => {
        const content = [
            '<!-- baton:if tool="claude-code" -->',
            '<!-- baton:if scope="project" -->',
            '<!-- baton:if type="memory" -->',
            '<!-- baton:if ide="vscode" -->',
            '<!-- baton:if not-tool="cursor" -->',
            "Deep content",
            "<!-- baton:endif -->",
            "<!-- baton:endif -->",
            "<!-- baton:endif -->",
            "<!-- baton:endif -->",
            "<!-- baton:endif -->",
        ].join("\n");
        const result = await processDirectives(content, makeOptions({ projectRoot }));
        expect(result).toContain("Deep content");
    });
});

describe("processDirectives — expression conditions", () => {
    let projectRoot: string;

    beforeEach(async () => {
        projectRoot = join(tmpdir(), `baton-expr-test-${Date.now()}`);
        await mkdir(projectRoot, { recursive: true });
    });

    afterEach(async () => {
        await rm(projectRoot, { recursive: true, force: true });
    });

    it("condition attribute — simple match", async () => {
        const content = [
            "Before",
            "<!-- baton:if condition=\"tool == 'claude-code'\" -->",
            "Claude only",
            "<!-- baton:endif -->",
            "After",
        ].join("\n");
        const result = await processDirectives(content, makeOptions());
        expect(result).toContain("Claude only");
        expect(result).toContain("Before");
        expect(result).toContain("After");
    });

    it("condition attribute — no match", async () => {
        const content = [
            "<!-- baton:if condition=\"tool == 'cursor'\" -->",
            "Cursor only",
            "<!-- baton:endif -->",
        ].join("\n");
        const result = await processDirectives(content, makeOptions());
        expect(result).not.toContain("Cursor only");
    });

    it("condition with OR", async () => {
        const content = [
            "<!-- baton:if condition=\"tool == 'cursor' or tool == 'claude-code'\" -->",
            "Multi-tool",
            "<!-- baton:endif -->",
        ].join("\n");
        const result = await processDirectives(content, makeOptions());
        expect(result).toContain("Multi-tool");
    });

    it("condition with AND", async () => {
        const content = [
            "<!-- baton:if condition=\"tool == 'claude-code' and scope == 'project'\" -->",
            "Both match",
            "<!-- baton:endif -->",
        ].join("\n");
        const result = await processDirectives(content, makeOptions());
        expect(result).toContain("Both match");
    });

    it("condition with NOT", async () => {
        const content = [
            "<!-- baton:if condition=\"not tool == 'cursor'\" -->",
            "Not cursor",
            "<!-- baton:endif -->",
        ].join("\n");
        const result = await processDirectives(content, makeOptions());
        expect(result).toContain("Not cursor");
    });

    it("condition with grouped expression", async () => {
        const content = [
            "<!-- baton:if condition=\"(tool == 'claude-code' or tool == 'cursor') and scope == 'project'\" -->",
            "Grouped",
            "<!-- baton:endif -->",
        ].join("\n");
        const result = await processDirectives(content, makeOptions());
        expect(result).toContain("Grouped");
    });

    it("condition with has() function", async () => {
        await writeFile(join(projectRoot, "tsconfig.json"), "{}");
        const content = [
            "<!-- baton:if condition=\"has('typescript')\" -->",
            "TypeScript project",
            "<!-- baton:endif -->",
        ].join("\n");
        const result = await processDirectives(content, makeOptions({ projectRoot }));
        expect(result).toContain("TypeScript project");
    });

    it("condition with file() function", async () => {
        await writeFile(join(projectRoot, "biome.json"), "{}");
        const content = [
            "<!-- baton:if condition=\"file('biome.json') or file('biome.jsonc')\" -->",
            "Biome configured",
            "<!-- baton:endif -->",
        ].join("\n");
        const result = await processDirectives(content, makeOptions({ projectRoot }));
        expect(result).toContain("Biome configured");
    });

    it("condition with var() function", async () => {
        const content = [
            "<!-- baton:if condition=\"var('lang') == 'typescript'\" -->",
            "TS var",
            "<!-- baton:endif -->",
        ].join("\n");
        const result = await processDirectives(
            content,
            makeOptions({ variables: { lang: "typescript" } }),
        );
        expect(result).toContain("TS var");
    });

    it("condition with else — keeps else branch on false", async () => {
        const content = [
            "<!-- baton:if condition=\"tool == 'cursor'\" -->",
            "Cursor branch",
            "<!-- baton:else -->",
            "Fallback branch",
            "<!-- baton:endif -->",
        ].join("\n");
        const result = await processDirectives(content, makeOptions({ projectRoot }));
        expect(result).not.toContain("Cursor branch");
        expect(result).toContain("Fallback branch");
    });

    it("condition with else — keeps if branch on true", async () => {
        const content = [
            "<!-- baton:if condition=\"tool == 'claude-code'\" -->",
            "Claude branch",
            "<!-- baton:else -->",
            "Fallback branch",
            "<!-- baton:endif -->",
        ].join("\n");
        const result = await processDirectives(content, makeOptions({ projectRoot }));
        expect(result).toContain("Claude branch");
        expect(result).not.toContain("Fallback branch");
    });

    it("warns when condition mixed with old-style attributes", async () => {
        const warn = vi.fn();
        const content = [
            '<!-- baton:if condition="tool == \'claude-code\'" tool="cursor" -->',
            "Content",
            "<!-- baton:endif -->",
        ].join("\n");
        const result = await processDirectives(content, makeOptions({ projectRoot }, warn));
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("condition attribute present"));
        // condition takes precedence
        expect(result).toContain("Content");
    });
});

describe("processDirectives — explain mode", () => {
    function makeExplainOptions(
        contextOverrides: Partial<DirectiveContext> = {},
    ): DirectiveOptions {
        return { context: makeContext(contextOverrides), explain: true };
    }

    it("annotates included conditional block", async () => {
        const content = [
            "Before",
            '<!-- baton:if tool="claude-code" -->',
            "Claude content",
            "<!-- baton:endif -->",
            "After",
        ].join("\n");
        const result = await processDirectives(content, makeExplainOptions());
        expect(result).toContain("[INCLUDED]");
        expect(result).toContain('tool="claude-code"');
        expect(result).toContain("Claude content");
        expect(result).toContain("[END]");
        expect(result).toContain("Before");
        expect(result).toContain("After");
    });

    it("annotates excluded conditional block", async () => {
        const content = [
            "Before",
            '<!-- baton:if tool="cursor" -->',
            "Cursor content",
            "<!-- baton:endif -->",
            "After",
        ].join("\n");
        const result = await processDirectives(
            content,
            makeExplainOptions({ currentTool: "claude-code" }),
        );
        expect(result).toContain("[EXCLUDED]");
        expect(result).toContain('tool="cursor"');
        expect(result).toContain("Cursor content");
        expect(result).toContain("[END]");
    });

    it("annotates if/else/endif — condition true", async () => {
        const content = [
            '<!-- baton:if tool="claude-code" -->',
            "Claude branch",
            "<!-- baton:else -->",
            "Other branch",
            "<!-- baton:endif -->",
        ].join("\n");
        const result = await processDirectives(content, makeExplainOptions());
        expect(result).toContain("[INCLUDED] if");
        expect(result).toContain("Claude branch");
        expect(result).toContain("[EXCLUDED] else");
        expect(result).toContain("Other branch");
    });

    it("annotates if/else/endif — condition false", async () => {
        const content = [
            '<!-- baton:if tool="cursor" -->',
            "Cursor branch",
            "<!-- baton:else -->",
            "Other branch",
            "<!-- baton:endif -->",
        ].join("\n");
        const result = await processDirectives(
            content,
            makeExplainOptions({ currentTool: "claude-code" }),
        );
        expect(result).toContain("[EXCLUDED] if");
        expect(result).toContain("Cursor branch");
        expect(result).toContain("[INCLUDED] else");
        expect(result).toContain("Other branch");
    });

    it("preserves baton:include comments in explain mode", async () => {
        const content = 'No conditionals <!-- baton:include src="missing.md" optional="true" -->';
        const result = await processDirectives(content, makeExplainOptions());
        // Include directives still resolve (not just annotated), but cleanup is skipped
        expect(result).toContain("No conditionals");
    });
});

describe("processDirectives — placements", () => {
    it("collects placements from link includes via onPlacement", async () => {
        const { mkdtemp } = await import("node:fs/promises");

        const profileRoot = await mkdtemp(join(tmpdir(), "profile-"));
        await writeFile(join(profileRoot, "fragment.md"), "Fragment content");

        const placements: FilePlacement[] = [];
        const content = '# Header\n<!-- baton:include src="fragment.md" mode="link" -->';
        const result = await processDirectives(content, {
            context: {
                projectRoot: "/project",
                profileRoot,
                profileName: "test-profile",
                currentTool: "claude-code",
                detectedTools: ["claude-code"],
                detectedIdes: [],
                scope: "project",
                contentType: "memory",
            },
            onPlacement: (p) => placements.push(p),
        });

        expect(placements).toHaveLength(1);
        expect(placements[0].targetRelative).toContain(".baton/includes/test-profile/fragment.md");
        expect(result).toContain(".baton/includes/test-profile/fragment.md");
        expect(result).toContain("# Header");
    });
});
