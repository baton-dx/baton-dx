/**
 * Token types produced by the expression tokenizer.
 */
export type TokenType =
    | "IDENTIFIER"
    | "STRING"
    | "LPAREN"
    | "RPAREN"
    | "LBRACKET"
    | "RBRACKET"
    | "COMMA"
    | "EQ"
    | "NEQ"
    | "AND"
    | "OR"
    | "NOT"
    | "IN"
    | "EOF";

/**
 * A single token from the expression tokenizer.
 */
export interface Token {
    type: TokenType;
    value: string;
    position: number;
}

/**
 * AST node types for condition expressions.
 */
export type ASTNode = BinaryNode | UnaryNode | ComparisonNode | FunctionCallNode | InNode;

export interface BinaryNode {
    type: "binary";
    operator: "and" | "or";
    left: ASTNode;
    right: ASTNode;
}

export interface UnaryNode {
    type: "unary";
    operator: "not";
    operand: ASTNode;
}

export interface ComparisonNode {
    type: "comparison";
    property: string;
    operator: "==" | "!=";
    value: string;
}

export interface FunctionCallNode {
    type: "function_call";
    name: string;
    arg: string;
    comparison?: { operator: "==" | "!="; value: string };
}

export interface InNode {
    type: "in";
    property: string;
    values: string[];
    negated: boolean;
}
