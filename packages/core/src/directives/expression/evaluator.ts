import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { detectHas } from "../conditions/has-registry.js";
import type { DirectiveContext } from "../types.js";
import type { ASTNode } from "./types.js";

/**
 * Evaluate an AST node against a directive context.
 * Returns true if the condition passes (content should be kept).
 */
export async function evaluateAST(
    node: ASTNode,
    context: DirectiveContext,
    onWarning?: (message: string) => void,
): Promise<boolean> {
    switch (node.type) {
        case "binary":
            return evaluateBinary(node, context, onWarning);
        case "unary":
            return !(await evaluateAST(node.operand, context, onWarning));
        case "comparison":
            return evaluateComparison(node, context, onWarning);
        case "function_call":
            return evaluateFunctionCall(node, context, onWarning);
    }
}

async function evaluateBinary(
    node: Extract<ASTNode, { type: "binary" }>,
    context: DirectiveContext,
    onWarning?: (message: string) => void,
): Promise<boolean> {
    const left = await evaluateAST(node.left, context, onWarning);
    // Short-circuit evaluation
    if (node.operator === "and") {
        return left ? evaluateAST(node.right, context, onWarning) : false;
    }
    // or
    return left ? true : evaluateAST(node.right, context, onWarning);
}

function evaluateComparison(
    node: Extract<ASTNode, { type: "comparison" }>,
    context: DirectiveContext,
    onWarning?: (message: string) => void,
): boolean {
    const resolved = resolveProperty(node.property, node.value, context, onWarning);
    if (resolved === undefined) return false;
    return node.operator === "==" ? resolved : !resolved;
}

/**
 * Resolve a property comparison against context.
 * Returns true if the value matches, false if not, undefined if property is unknown.
 */
function resolveProperty(
    property: string,
    value: string,
    context: DirectiveContext,
    onWarning?: (message: string) => void,
): boolean | undefined {
    switch (property) {
        case "tool":
            return context.currentTool === value;
        case "ide":
            return context.detectedIdes.includes(value);
        case "scope":
            return context.scope === value;
        case "type":
            return context.contentType === value;
        default:
            onWarning?.(`Unknown property '${property}' in condition expression`);
            return undefined;
    }
}

async function evaluateFunctionCall(
    node: Extract<ASTNode, { type: "function_call" }>,
    context: DirectiveContext,
    onWarning?: (message: string) => void,
): Promise<boolean> {
    switch (node.name) {
        case "has":
            return evaluateHas(node.arg, context, onWarning);
        case "file":
            return evaluateFile(node.arg, context);
        case "var":
            return evaluateVar(node.arg, node.comparison, context);
        default:
            onWarning?.(`Unknown function '${node.name}()' in condition expression`);
            return false;
    }
}

async function evaluateHas(
    key: string,
    context: DirectiveContext,
    onWarning?: (message: string) => void,
): Promise<boolean> {
    const result = await detectHas(context.projectRoot, key);
    if (result === undefined) {
        onWarning?.(`Unknown has-characteristic '${key}'`);
        return false;
    }
    return result;
}

async function evaluateFile(path: string, context: DirectiveContext): Promise<boolean> {
    try {
        await access(resolve(context.projectRoot, path));
        return true;
    } catch {
        return false;
    }
}

function evaluateVar(
    name: string,
    comparison: { operator: "==" | "!="; value: string } | undefined,
    context: DirectiveContext,
): boolean {
    const variables = context.variables ?? {};

    if (!comparison) {
        // Existence check: var('name') → truthy if variable exists and is non-empty
        return name in variables && variables[name] !== "";
    }

    // Value comparison: var('name') == 'value'
    const actual = variables[name];
    const matches = actual === comparison.value;
    return comparison.operator === "==" ? matches : !matches;
}
