import { describe, expect, it } from "vitest";
import { ConditionTokenError, tokenize } from "./tokenizer.js";

describe("tokenize", () => {
    it("tokenizes a simple comparison", () => {
        const tokens = tokenize("tool == 'claude-code'");
        expect(tokens).toEqual([
            { type: "IDENTIFIER", value: "tool", position: 0 },
            { type: "EQ", value: "==", position: 5 },
            { type: "STRING", value: "claude-code", position: 8 },
            { type: "EOF", value: "", position: 21 },
        ]);
    });

    it("tokenizes without whitespace", () => {
        const tokens = tokenize("tool=='claude-code'");
        expect(tokens).toEqual([
            { type: "IDENTIFIER", value: "tool", position: 0 },
            { type: "EQ", value: "==", position: 4 },
            { type: "STRING", value: "claude-code", position: 6 },
            { type: "EOF", value: "", position: 19 },
        ]);
    });

    it("tokenizes != operator", () => {
        const tokens = tokenize("tool != 'cursor'");
        expect(tokens[1]).toEqual({ type: "NEQ", value: "!=", position: 5 });
    });

    it("tokenizes uppercase AND, OR, NOT keywords", () => {
        const tokens = tokenize("has('ts') AND NOT has('prettier')");
        const types = tokens.map((t) => t.type);
        expect(types).toEqual([
            "IDENTIFIER",
            "LPAREN",
            "STRING",
            "RPAREN",
            "AND",
            "NOT",
            "IDENTIFIER",
            "LPAREN",
            "STRING",
            "RPAREN",
            "EOF",
        ]);
    });

    it("tokenizes IN keyword", () => {
        const tokens = tokenize("tool IN ['a', 'b']");
        expect(tokens).toEqual([
            { type: "IDENTIFIER", value: "tool", position: 0 },
            { type: "IN", value: "IN", position: 5 },
            { type: "LBRACKET", value: "[", position: 8 },
            { type: "STRING", value: "a", position: 9 },
            { type: "COMMA", value: ",", position: 12 },
            { type: "STRING", value: "b", position: 14 },
            { type: "RBRACKET", value: "]", position: 17 },
            { type: "EOF", value: "", position: 18 },
        ]);
    });

    it("tokenizes brackets and comma", () => {
        const tokens = tokenize("['a','b']");
        const types = tokens.map((t) => t.type);
        expect(types).toEqual(["LBRACKET", "STRING", "COMMA", "STRING", "RBRACKET", "EOF"]);
    });

    it("treats lowercase 'and', 'or', 'not', 'in' as identifiers", () => {
        const tokens = tokenize("and or not in");
        expect(tokens.map((t) => t.type)).toEqual([
            "IDENTIFIER",
            "IDENTIFIER",
            "IDENTIFIER",
            "IDENTIFIER",
            "EOF",
        ]);
    });

    it("treats mixed-case 'And', 'Or', 'Not', 'In' as identifiers", () => {
        const tokens = tokenize("And Or Not In");
        expect(tokens.map((t) => t.type)).toEqual([
            "IDENTIFIER",
            "IDENTIFIER",
            "IDENTIFIER",
            "IDENTIFIER",
            "EOF",
        ]);
    });

    it("tokenizes parenthesized groups", () => {
        const tokens = tokenize("(tool == 'a' OR tool == 'b') AND scope == 'project'");
        const types = tokens.map((t) => t.type);
        expect(types[0]).toBe("LPAREN");
        expect(types).toContain("RPAREN");
    });

    it("tokenizes function call with comparison", () => {
        const tokens = tokenize("var('lang') == 'typescript'");
        const types = tokens.map((t) => t.type);
        expect(types).toEqual(["IDENTIFIER", "LPAREN", "STRING", "RPAREN", "EQ", "STRING", "EOF"]);
    });

    it("preserves whitespace inside strings", () => {
        const tokens = tokenize("var('my key') == 'hello world'");
        expect(tokens[2].value).toBe("my key");
        expect(tokens[5].value).toBe("hello world");
    });

    it("throws on unterminated string", () => {
        expect(() => tokenize("tool == 'unclosed")).toThrow(ConditionTokenError);
    });

    it("throws on unexpected character", () => {
        expect(() => tokenize("tool == @value")).toThrow(ConditionTokenError);
    });

    it("throws on && (removed symbol operator)", () => {
        expect(() => tokenize("tool == 'a' && tool == 'b'")).toThrow(ConditionTokenError);
    });

    it("throws on || (removed symbol operator)", () => {
        expect(() => tokenize("tool == 'a' || tool == 'b'")).toThrow(ConditionTokenError);
    });

    it("throws on standalone ! (removed symbol operator)", () => {
        expect(() => tokenize("!has('ts')")).toThrow(ConditionTokenError);
    });

    it("tokenizes empty-argument-like edge case: bare function", () => {
        const tokens = tokenize("has('typescript')");
        expect(tokens.map((t) => t.type)).toEqual([
            "IDENTIFIER",
            "LPAREN",
            "STRING",
            "RPAREN",
            "EOF",
        ]);
    });
});
