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

    it("tokenizes word operators: and, or, not", () => {
        const tokens = tokenize("has('ts') and not has('prettier')");
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

    it("tokenizes symbol operators: &&, ||, !", () => {
        const tokens = tokenize("has('ts') && !has('prettier')");
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

    it("tokenizes parenthesized groups", () => {
        const tokens = tokenize("(tool == 'a' or tool == 'b') and scope == 'project'");
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

    it("tokenizes empty-argument-like edge case: bare function", () => {
        // This won't parse correctly, but tokenizer should still work
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
