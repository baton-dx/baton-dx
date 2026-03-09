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

function makeEndif(startIndex = 100): ParsedDirective {
    return { type: "endif", attributes: {}, startIndex, endIndex: startIndex + 10, raw: "" };
}

describe("evaluateCondition", () => {
    it('tool="claude-code" matches currentTool', () => {
        expect(evaluateCondition({ tool: "claude-code" }, makeContext())).toBe(true);
    });

    it('tool="cursor" does not match when currentTool is claude-code', () => {
        expect(evaluateCondition({ tool: "cursor" }, makeContext())).toBe(false);
    });

    it('tool="cursor,windsurf" OR logic', () => {
        expect(
            evaluateCondition({ tool: "cursor,windsurf" }, makeContext({ currentTool: "cursor" })),
        ).toBe(true);
        expect(
            evaluateCondition(
                { tool: "cursor,windsurf" },
                makeContext({ currentTool: "claude-code" }),
            ),
        ).toBe(false);
    });

    it('not-tool="claude-code" negation', () => {
        expect(evaluateCondition({ "not-tool": "claude-code" }, makeContext())).toBe(false);
        expect(evaluateCondition({ "not-tool": "cursor" }, makeContext())).toBe(true);
    });

    it('ide="vscode" matches detectedIdes', () => {
        expect(evaluateCondition({ ide: "vscode" }, makeContext())).toBe(true);
        expect(evaluateCondition({ ide: "jetbrains" }, makeContext())).toBe(false);
    });

    it('ide="vscode,jetbrains" OR logic', () => {
        expect(evaluateCondition({ ide: "vscode,jetbrains" }, makeContext())).toBe(true);
    });

    it('not-ide="jetbrains" negation', () => {
        expect(evaluateCondition({ "not-ide": "jetbrains" }, makeContext())).toBe(true);
        expect(evaluateCondition({ "not-ide": "vscode" }, makeContext())).toBe(false);
    });

    it('scope="project" matches', () => {
        expect(evaluateCondition({ scope: "project" }, makeContext())).toBe(true);
        expect(evaluateCondition({ scope: "global" }, makeContext())).toBe(false);
    });

    it('type="memory" matches contentType', () => {
        expect(evaluateCondition({ type: "memory" }, makeContext())).toBe(true);
        expect(evaluateCondition({ type: "rules" }, makeContext())).toBe(false);
    });

    it('type="rules,agents" OR logic', () => {
        expect(
            evaluateCondition({ type: "rules,agents" }, makeContext({ contentType: "agents" })),
        ).toBe(true);
    });

    it("no recognized condition → warning, fail-open (true)", () => {
        const warn = vi.fn();
        expect(evaluateCondition({ unknown: "value" }, makeContext(), warn)).toBe(true);
        expect(warn).toHaveBeenCalledWith("baton:if has no recognized condition attribute");
    });

    it("multiple condition attributes → warning, uses first", () => {
        const warn = vi.fn();
        evaluateCondition({ tool: "claude-code", scope: "project" }, makeContext(), warn);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("multiple condition attributes"));
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
