import type { Token, TokenType } from "./types.js";

const KEYWORDS: Record<string, TokenType> = {
    and: "AND",
    or: "OR",
    not: "NOT",
};

/**
 * Tokenize an expression string into a list of tokens.
 *
 * Handles:
 * - String literals: `'...'`
 * - Operators: `==`, `!=`, `&&`, `||`, `!` (not followed by `=`)
 * - Parentheses: `(`, `)`
 * - Identifiers: `[a-z][a-zA-Z0-9]*` — checked against keyword set
 * - Whitespace is skipped between tokens
 */
export function tokenize(expression: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;

    while (i < expression.length) {
        const ch = expression[i];

        // Skip whitespace
        if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
            i++;
            continue;
        }

        // String literal
        if (ch === "'") {
            const start = i;
            i++; // skip opening quote
            let value = "";
            while (i < expression.length && expression[i] !== "'") {
                value += expression[i];
                i++;
            }
            if (i >= expression.length) {
                throw new ConditionTokenError(expression, start, "Unterminated string literal");
            }
            i++; // skip closing quote
            tokens.push({ type: "STRING", value, position: start });
            continue;
        }

        // ==
        if (ch === "=" && expression[i + 1] === "=") {
            tokens.push({ type: "EQ", value: "==", position: i });
            i += 2;
            continue;
        }

        // !=
        if (ch === "!" && expression[i + 1] === "=") {
            tokens.push({ type: "NEQ", value: "!=", position: i });
            i += 2;
            continue;
        }

        // ! (NOT, when not followed by =)
        if (ch === "!") {
            tokens.push({ type: "NOT", value: "!", position: i });
            i++;
            continue;
        }

        // &&
        if (ch === "&" && expression[i + 1] === "&") {
            tokens.push({ type: "AND", value: "&&", position: i });
            i += 2;
            continue;
        }

        // ||
        if (ch === "|" && expression[i + 1] === "|") {
            tokens.push({ type: "OR", value: "||", position: i });
            i += 2;
            continue;
        }

        // Parentheses
        if (ch === "(") {
            tokens.push({ type: "LPAREN", value: "(", position: i });
            i++;
            continue;
        }
        if (ch === ")") {
            tokens.push({ type: "RPAREN", value: ")", position: i });
            i++;
            continue;
        }

        // Identifier or keyword
        if (/[a-z]/i.test(ch)) {
            const start = i;
            while (i < expression.length && /[a-zA-Z0-9]/.test(expression[i])) {
                i++;
            }
            const word = expression.slice(start, i);
            const keywordType = KEYWORDS[word];
            tokens.push({
                type: keywordType ?? "IDENTIFIER",
                value: word,
                position: start,
            });
            continue;
        }

        throw new ConditionTokenError(expression, i, `Unexpected character '${ch}'`);
    }

    tokens.push({ type: "EOF", value: "", position: i });
    return tokens;
}

/**
 * Error thrown when tokenization fails.
 */
export class ConditionTokenError extends Error {
    constructor(
        public readonly expression: string,
        public readonly position: number,
        message: string,
    ) {
        const pointer = `${" ".repeat(position)}^`;
        super(`${message}\n  ${expression}\n  ${pointer}`);
        this.name = "ConditionTokenError";
    }
}
