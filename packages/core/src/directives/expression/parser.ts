import type { ASTNode, Token } from "./types.js";

/**
 * Parse a token list into an AST using recursive descent.
 *
 * Grammar:
 *   expression = or_expr
 *   or_expr    = and_expr { ("or" | "||") and_expr }
 *   and_expr   = unary_expr { ("and" | "&&") unary_expr }
 *   unary_expr = ("not" | "!") unary_expr | primary
 *   primary    = comparison | func_expr | "(" expression ")"
 *   comparison = IDENTIFIER ("==" | "!=") STRING
 *   func_expr  = IDENTIFIER "(" STRING ")" [ ("==" | "!=") STRING ]
 */
export function parse(tokens: Token[]): ASTNode {
    const parser = new Parser(tokens);
    const ast = parser.parseExpression();
    parser.expectEnd();
    return ast;
}

class Parser {
    private pos = 0;

    constructor(private tokens: Token[]) {}

    parseExpression(): ASTNode {
        return this.parseOr();
    }

    private parseOr(): ASTNode {
        let left = this.parseAnd();
        while (this.check("OR")) {
            this.advance();
            const right = this.parseAnd();
            left = { type: "binary", operator: "or", left, right };
        }
        return left;
    }

    private parseAnd(): ASTNode {
        let left = this.parseUnary();
        while (this.check("AND")) {
            this.advance();
            const right = this.parseUnary();
            left = { type: "binary", operator: "and", left, right };
        }
        return left;
    }

    private parseUnary(): ASTNode {
        if (this.check("NOT")) {
            this.advance();
            const operand = this.parseUnary();
            return { type: "unary", operator: "not", operand };
        }
        return this.parsePrimary();
    }

    private parsePrimary(): ASTNode {
        // Grouped expression: "(" expression ")"
        if (this.check("LPAREN")) {
            this.advance();
            const expr = this.parseExpression();
            this.expect("RPAREN", "Expected closing ')'");
            return expr;
        }

        // Must be an identifier (property or function name)
        const ident = this.expect("IDENTIFIER", "Expected property name or function");

        // Function call: identifier "(" string ")" [ ("==" | "!=") string ]
        if (this.check("LPAREN")) {
            this.advance();
            const arg = this.expect("STRING", "Expected string argument in function call");
            this.expect("RPAREN", "Expected closing ')' after function argument");

            // Optional comparison after function call: var('x') == 'y'
            if (this.check("EQ") || this.check("NEQ")) {
                const op = this.advance();
                const val = this.expect("STRING", `Expected string after '${op.value}'`);
                return {
                    type: "function_call",
                    name: ident.value,
                    arg: arg.value,
                    comparison: { operator: op.value as "==" | "!=", value: val.value },
                };
            }

            return { type: "function_call", name: ident.value, arg: arg.value };
        }

        // Comparison: identifier ("==" | "!=") string
        if (this.check("EQ") || this.check("NEQ")) {
            const op = this.advance();
            const val = this.expect("STRING", `Expected string after '${op.value}'`);
            return {
                type: "comparison",
                property: ident.value,
                operator: op.value as "==" | "!=",
                value: val.value,
            };
        }

        throw new ConditionParseError(
            this.tokens,
            ident,
            `Expected '==', '!=', or '(' after '${ident.value}'`,
        );
    }

    expectEnd(): void {
        if (!this.check("EOF")) {
            const token = this.peek();
            throw new ConditionParseError(this.tokens, token, `Unexpected token '${token.value}'`);
        }
    }

    private peek(): Token {
        return this.tokens[this.pos];
    }

    private check(type: string): boolean {
        return this.peek().type === type;
    }

    private advance(): Token {
        const token = this.tokens[this.pos];
        this.pos++;
        return token;
    }

    private expect(type: string, message: string): Token {
        if (!this.check(type)) {
            throw new ConditionParseError(this.tokens, this.peek(), message);
        }
        return this.advance();
    }
}

/**
 * Error thrown when parsing fails, with position pointer.
 */
export class ConditionParseError extends Error {
    constructor(tokens: Token[], errorToken: Token, message: string) {
        // Reconstruct expression from tokens for the error message
        const lastToken = tokens[tokens.length - 1];
        const _exprLength = lastToken.position + lastToken.value.length;
        const pointer = `${" ".repeat(errorToken.position)}^`;
        // Use the source expression from token positions
        const parts: string[] = [];
        for (const t of tokens) {
            if (t.type !== "EOF") {
                parts.push(t.type === "STRING" ? `'${t.value}'` : t.value);
            }
        }
        const expr = parts.join(" ");
        super(`Invalid condition: ${message}\n  ${expr}\n  ${pointer}`);
        this.name = "ConditionParseError";
    }
}
