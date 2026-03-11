import { describe, expect, it, vi } from "vitest";
import { evaluateCondition, matchConditionalPairs } from "./conditional.js";
import type { DirectiveContext, ParsedDirective } from "./types.js";

function makeContext(overrides: Partial<DirectiveContext> = {}): DirectiveContext {
    return {
        projectRoot: "/project",
        currentTool: "claude-code",
        detectedTools: ["claude-code", "cursor"],
        detectedIdes: ["vscode"],
        scope: "project",
        contentType: "memory",
        ...overrides,
    };
}

function makeIf(attrs: Record<string, string>, startIndex = 0): ParsedDirective {
    return { type: "if", attributes: attrs, startIndex, endIndex: startIndex + 10, raw: "" };
}

function makeElse(startIndex = 50): ParsedDirective {
    return { type: "else", attributes: {}, startIndex, endIndex: startIndex + 10, raw: "" };
}

function makeEndif(startIndex = 100): ParsedDirective {
    return { type: "endif", attributes: {}, startIndex, endIndex: startIndex + 10, raw: "" };
}

describe("evaluateCondition", () => {
    it('tool="claude-code" matches currentTool', async () => {
        expect(await evaluateCondition({ tool: "claude-code" }, makeContext())).toBe(true);
    });

    it('tool="cursor" does not match when currentTool is claude-code', async () => {
        expect(await evaluateCondition({ tool: "cursor" }, makeContext())).toBe(false);
    });

    it('tool="cursor,windsurf" OR logic', async () => {
        expect(
            await evaluateCondition(
                { tool: "cursor,windsurf" },
                makeContext({ currentTool: "cursor" }),
            ),
        ).toBe(true);
        expect(
            await evaluateCondition(
                { tool: "cursor,windsurf" },
                makeContext({ currentTool: "claude-code" }),
            ),
        ).toBe(false);
    });

    it('not-tool="claude-code" negation', async () => {
        expect(await evaluateCondition({ "not-tool": "claude-code" }, makeContext())).toBe(false);
        expect(await evaluateCondition({ "not-tool": "cursor" }, makeContext())).toBe(true);
    });

    it('ide="vscode" matches detectedIdes', async () => {
        expect(await evaluateCondition({ ide: "vscode" }, makeContext())).toBe(true);
        expect(await evaluateCondition({ ide: "jetbrains" }, makeContext())).toBe(false);
    });

    it('ide="vscode,jetbrains" OR logic', async () => {
        expect(await evaluateCondition({ ide: "vscode,jetbrains" }, makeContext())).toBe(true);
    });

    it('not-ide="jetbrains" negation', async () => {
        expect(await evaluateCondition({ "not-ide": "jetbrains" }, makeContext())).toBe(true);
        expect(await evaluateCondition({ "not-ide": "vscode" }, makeContext())).toBe(false);
    });

    it('scope="project" matches', async () => {
        expect(await evaluateCondition({ scope: "project" }, makeContext())).toBe(true);
        expect(await evaluateCondition({ scope: "global" }, makeContext())).toBe(false);
    });

    it('type="memory" matches contentType', async () => {
        expect(await evaluateCondition({ type: "memory" }, makeContext())).toBe(true);
        expect(await evaluateCondition({ type: "rules" }, makeContext())).toBe(false);
    });

    it('type="rules,agents" OR logic', async () => {
        expect(
            await evaluateCondition(
                { type: "rules,agents" },
                makeContext({ contentType: "agents" }),
            ),
        ).toBe(true);
    });

    it("no recognized condition → warning, fail-open (true)", async () => {
        const warn = vi.fn();
        expect(await evaluateCondition({ unknown: "value" }, makeContext(), warn)).toBe(true);
        expect(warn).toHaveBeenCalledWith("baton:if has no recognized condition attribute");
    });

    it("AND-composition: all conditions must pass", async () => {
        // Both match → true
        expect(
            await evaluateCondition({ tool: "claude-code", scope: "project" }, makeContext()),
        ).toBe(true);
        // tool matches but scope doesn't → false
        expect(
            await evaluateCondition({ tool: "claude-code", scope: "global" }, makeContext()),
        ).toBe(false);
        // scope matches but tool doesn't → false
        expect(
            await evaluateCondition({ tool: "cursor", scope: "project" }, makeContext()),
        ).toBe(false);
    });

    it('var="lang" checks variable existence', async () => {
        expect(
            await evaluateCondition({ var: "lang" }, makeContext({ variables: { lang: "ts" } })),
        ).toBe(true);
        expect(await evaluateCondition({ var: "lang" }, makeContext({ variables: {} }))).toBe(
            false,
        );
        expect(await evaluateCondition({ var: "lang" }, makeContext())).toBe(false);
    });

    it('var="lang:typescript" checks variable value', async () => {
        expect(
            await evaluateCondition(
                { var: "lang:typescript" },
                makeContext({ variables: { lang: "typescript" } }),
            ),
        ).toBe(true);
        expect(
            await evaluateCondition(
                { var: "lang:typescript" },
                makeContext({ variables: { lang: "rust" } }),
            ),
        ).toBe(false);
    });

    it('not-var="legacy" negation', async () => {
        expect(
            await evaluateCondition(
                { "not-var": "legacy" },
                makeContext({ variables: { legacy: "true" } }),
            ),
        ).toBe(false);
        expect(
            await evaluateCondition({ "not-var": "legacy" }, makeContext({ variables: {} })),
        ).toBe(true);
    });
});

describe("matchConditionalPairs", () => {
    it("matches a simple if/endif pair", () => {
        const directives: ParsedDirective[] = [makeIf({ tool: "claude-code" }, 0), makeEndif(50)];
        const { matched, unmatchedIfs, unmatchedEndifs } = matchConditionalPairs(directives);
        expect(matched).toHaveLength(1);
        expect(matched[0].depth).toBe(0);
        expect(unmatchedIfs).toHaveLength(0);
        expect(unmatchedEndifs).toHaveLength(0);
    });

    it("matches nested pairs innermost-first", () => {
        const directives: ParsedDirective[] = [
            makeIf({ tool: "claude-code" }, 0),
            makeIf({ scope: "project" }, 20),
            makeEndif(40),
            makeEndif(60),
        ];
        const { matched } = matchConditionalPairs(directives);
        expect(matched).toHaveLength(2);
        // Innermost first (depth 1 before depth 0)
        expect(matched[0].depth).toBe(1);
        expect(matched[1].depth).toBe(0);
    });

    it("reports unmatched endif", () => {
        const warn = vi.fn();
        const directives: ParsedDirective[] = [makeEndif(0)];
        const { unmatchedEndifs } = matchConditionalPairs(directives, warn);
        expect(unmatchedEndifs).toHaveLength(1);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("Unmatched baton:endif"));
    });

    it("reports unmatched if", () => {
        const warn = vi.fn();
        const directives: ParsedDirective[] = [makeIf({ tool: "claude-code" }, 0)];
        const { unmatchedIfs } = matchConditionalPairs(directives, warn);
        expect(unmatchedIfs).toHaveLength(1);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("Unmatched baton:if"));
    });

    it("warns when nesting exceeds max depth", () => {
        const warn = vi.fn();
        // Create 6 nested ifs (max is 5)
        const directives: ParsedDirective[] = [];
        for (let i = 0; i < 6; i++) {
            directives.push(makeIf({ tool: "x" }, i * 10));
        }
        for (let i = 0; i < 6; i++) {
            directives.push(makeEndif(100 + i * 10));
        }
        matchConditionalPairs(directives, warn);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("nesting depth exceeds"));
    });

    it("matches if/else/endif block", () => {
        const directives: ParsedDirective[] = [
            makeIf({ tool: "claude-code" }, 0),
            makeElse(30),
            makeEndif(60),
        ];
        const { matched } = matchConditionalPairs(directives);
        expect(matched).toHaveLength(1);
        expect(matched[0].elseDirective).toBeDefined();
        expect(matched[0].elseDirective?.startIndex).toBe(30);
    });

    it("warns on duplicate baton:else", () => {
        const warn = vi.fn();
        const directives: ParsedDirective[] = [
            makeIf({ tool: "claude-code" }, 0),
            makeElse(20),
            makeElse(40),
            makeEndif(60),
        ];
        matchConditionalPairs(directives, warn);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("Duplicate baton:else"));
    });

    it("warns on unmatched baton:else", () => {
        const warn = vi.fn();
        const directives: ParsedDirective[] = [makeElse(0)];
        matchConditionalPairs(directives, warn);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("Unmatched baton:else"));
    });

    it("skips non-conditional directives", () => {
        const directives: ParsedDirective[] = [
            makeIf({ tool: "claude-code" }, 0),
            {
                type: "include",
                attributes: { src: "file.md" },
                startIndex: 20,
                endIndex: 50,
                raw: "",
            },
            makeEndif(60),
        ];
        const { matched } = matchConditionalPairs(directives);
        expect(matched).toHaveLength(1);
    });
});
