/**
 * Token types produced by the expression tokenizer.
 */
export type TokenType =
    | "IDENTIFIER"
    | "STRING"
    | "LPAREN"
    | "RPAREN"
    | "EQ"
    | "NEQ"
    | "AND"
    | "OR"
    | "NOT"
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
export type ASTNode = BinaryNode | UnaryNode | ComparisonNode | FunctionCallNode;

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
