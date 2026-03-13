import { describe, expect, it } from "vitest";
import { ConditionParseError, parse } from "./parser.js";
import { tokenize } from "./tokenizer.js";
import type { ASTNode } from "./types.js";

function parseExpr(expr: string): ASTNode {
    return parse(tokenize(expr));
}

describe("parse", () => {
    it("parses a simple comparison", () => {
        const ast = parseExpr("tool == 'claude-code'");
        expect(ast).toEqual({
            type: "comparison",
            property: "tool",
            operator: "==",
            value: "claude-code",
        });
    });

    it("parses != comparison", () => {
        const ast = parseExpr("tool != 'cursor'");
        expect(ast).toEqual({
            type: "comparison",
            property: "tool",
            operator: "!=",
            value: "cursor",
        });
    });

    it("parses a function call", () => {
        const ast = parseExpr("has('typescript')");
        expect(ast).toEqual({
            type: "function_call",
            name: "has",
            arg: "typescript",
        });
    });

    it("parses a function call with comparison", () => {
        const ast = parseExpr("var('lang') == 'typescript'");
        expect(ast).toEqual({
            type: "function_call",
            name: "var",
            arg: "lang",
            comparison: { operator: "==", value: "typescript" },
        });
    });

    it("parses OR expression", () => {
        const ast = parseExpr("tool == 'cursor' OR tool == 'windsurf'");
        expect(ast.type).toBe("binary");
        expect((ast as { operator: string }).operator).toBe("or");
    });

    it("parses AND expression", () => {
        const ast = parseExpr("tool == 'claude-code' AND scope == 'project'");
        expect(ast.type).toBe("binary");
        expect((ast as { operator: string }).operator).toBe("and");
    });

    it("parses NOT expression", () => {
        const ast = parseExpr("NOT has('prettier')");
        expect(ast).toEqual({
            type: "unary",
            operator: "not",
            operand: { type: "function_call", name: "has", arg: "prettier" },
        });
    });

    it("respects operator precedence: NOT > AND > OR", () => {
        // "a OR b AND NOT c" → "a OR (b AND (NOT c))"
        const ast = parseExpr("tool == 'a' OR tool == 'b' AND NOT has('c')");
        expect(ast.type).toBe("binary");
        const binary = ast as { type: "binary"; operator: string; left: ASTNode; right: ASTNode };
        expect(binary.operator).toBe("or");
        expect(binary.right.type).toBe("binary");
        const right = binary.right as { operator: string; right: ASTNode };
        expect(right.operator).toBe("and");
        expect(right.right.type).toBe("unary");
    });

    it("parses grouped expressions", () => {
        const ast = parseExpr("(tool == 'claude-code' OR tool == 'cursor') AND scope == 'project'");
        expect(ast.type).toBe("binary");
        const binary = ast as { type: "binary"; operator: string; left: ASTNode; right: ASTNode };
        expect(binary.operator).toBe("and");
        expect(binary.left.type).toBe("binary");
        const left = binary.left as { operator: string };
        expect(left.operator).toBe("or");
    });

    // --- IN expression ---

    it("parses IN expression", () => {
        const ast = parseExpr("tool IN ['claude-code', 'cursor', 'windsurf']");
        expect(ast).toEqual({
            type: "in",
            property: "tool",
            values: ["claude-code", "cursor", "windsurf"],
            negated: false,
        });
    });

    it("parses NOT IN expression", () => {
        const ast = parseExpr("tool NOT IN ['aider']");
        expect(ast).toEqual({
            type: "in",
            property: "tool",
            values: ["aider"],
            negated: true,
        });
    });

    it("parses IN combined with AND", () => {
        const ast = parseExpr("tool IN ['a', 'b'] AND scope == 'project'");
        expect(ast.type).toBe("binary");
        const binary = ast as { type: "binary"; operator: string; left: ASTNode; right: ASTNode };
        expect(binary.operator).toBe("and");
        expect(binary.left.type).toBe("in");
        expect(binary.right.type).toBe("comparison");
    });

    it("throws on IN without brackets", () => {
        expect(() => parseExpr("tool IN 'a'")).toThrow(ConditionParseError);
    });

    it("throws on IN with empty list", () => {
        expect(() => parseExpr("tool IN []")).toThrow(ConditionParseError);
    });

    // --- Error cases ---

    it("throws on missing string after ==", () => {
        expect(() => parseExpr("tool ==")).toThrow(ConditionParseError);
    });

    it("throws on bare identifier without operator", () => {
        expect(() => parseExpr("tool")).toThrow(ConditionParseError);
    });

    it("throws on unmatched parenthesis", () => {
        expect(() => parseExpr("(tool == 'a'")).toThrow(ConditionParseError);
    });

    it("throws on trailing tokens", () => {
        expect(() => parseExpr("tool == 'a' 'extra'")).toThrow(ConditionParseError);
    });

    it("parses complex nested expression", () => {
        const ast = parseExpr(
            "(tool == 'claude-code' OR tool == 'cursor') AND has('typescript') AND NOT file('biome.json')",
        );
        expect(ast.type).toBe("binary");
    });
});
