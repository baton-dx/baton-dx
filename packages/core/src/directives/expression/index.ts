import type { DirectiveContext } from "../types.js";
import { evaluateAST } from "./evaluator.js";
import { ConditionParseError, parse } from "./parser.js";
import { ConditionTokenError, tokenize } from "./tokenizer.js";

export type { ASTNode } from "./types.js";

/**
 * Parse and evaluate an expression-based condition string.
 *
 * On parse error: emits warning and returns true (fail-open).
 * On unknown property/function: emits warning and returns false for that node.
 */
export async function evaluateExpressionCondition(
    expression: string,
    context: DirectiveContext,
    onWarning?: (message: string) => void,
): Promise<boolean> {
    try {
        const tokens = tokenize(expression);
        const ast = parse(tokens);
        return evaluateAST(ast, context, onWarning);
    } catch (error) {
        if (error instanceof ConditionParseError || error instanceof ConditionTokenError) {
            onWarning?.(error.message);
            return true; // fail-open
        }
        throw error;
    }
}
