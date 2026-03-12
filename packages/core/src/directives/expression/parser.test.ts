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
        const ast = parseExpr("tool == 'cursor' or tool == 'windsurf'");
        expect(ast.type).toBe("binary");
        expect((ast as { operator: string }).operator).toBe("or");
    });

    it("parses AND expression", () => {
        const ast = parseExpr("tool == 'claude-code' and scope == 'project'");
        expect(ast.type).toBe("binary");
        expect((ast as { operator: string }).operator).toBe("and");
    });

    it("parses NOT expression", () => {
        const ast = parseExpr("not has('prettier')");
        expect(ast).toEqual({
            type: "unary",
            operator: "not",
            operand: { type: "function_call", name: "has", arg: "prettier" },
        });
    });

    it("respects operator precedence: not > and > or", () => {
        // "a or b and not c" → "a or (b and (not c))"
        const ast = parseExpr("tool == 'a' or tool == 'b' and not has('c')");
        expect(ast.type).toBe("binary");
        const binary = ast as { type: "binary"; operator: string; left: ASTNode; right: ASTNode };
        expect(binary.operator).toBe("or");
        expect(binary.right.type).toBe("binary");
        const right = binary.right as { operator: string; right: ASTNode };
        expect(right.operator).toBe("and");
        expect(right.right.type).toBe("unary");
    });

    it("parses grouped expressions", () => {
        const ast = parseExpr("(tool == 'claude-code' or tool == 'cursor') and scope == 'project'");
        expect(ast.type).toBe("binary");
        const binary = ast as { type: "binary"; operator: string; left: ASTNode; right: ASTNode };
        expect(binary.operator).toBe("and");
        expect(binary.left.type).toBe("binary");
        const left = binary.left as { operator: string };
        expect(left.operator).toBe("or");
    });

    it("parses && and || aliases", () => {
        const ast = parseExpr("tool == 'a' || tool == 'b' && has('c')");
        expect(ast.type).toBe("binary");
        const binary = ast as { type: "binary"; operator: string };
        expect(binary.operator).toBe("or");
    });

    it("parses ! alias for not", () => {
        const ast = parseExpr("!has('prettier')");
        expect(ast).toEqual({
            type: "unary",
            operator: "not",
            operand: { type: "function_call", name: "has", arg: "prettier" },
        });
    });

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
            "(tool == 'claude-code' or tool == 'cursor') and has('typescript') and not file('biome.json')",
        );
        // Should parse without error — structure is deeply nested AND chain
        expect(ast.type).toBe("binary");
    });
});
