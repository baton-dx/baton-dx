import type { DirectiveContext } from "../types.js";

/**
 * A condition evaluator function.
 *
 * @param value - The attribute value (may be comma-separated for OR logic)
 * @param context - The directive context
 * @returns true if condition passes, false if it fails
 */
export type ConditionEvaluator = (
    value: string,
    context: DirectiveContext,
) => boolean;

/**
 * An async condition evaluator (for file-system checks).
 */
export type AsyncConditionEvaluator = (
    value: string,
    context: DirectiveContext,
) => Promise<boolean>;

/** Split comma-separated values, trim, and filter empty. */
export function splitValues(value: string): string[] {
    return value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
}

/**
 * Registry of synchronous condition evaluators.
 * Keys are the attribute names used in baton:if directives.
 */
const syncRegistry = new Map<string, ConditionEvaluator>();

/**
 * Registry of async condition evaluators (file, has, var checks).
 */
const asyncRegistry = new Map<string, AsyncConditionEvaluator>();

export function registerCondition(key: string, evaluator: ConditionEvaluator): void {
    syncRegistry.set(key, evaluator);
}

export function registerAsyncCondition(key: string, evaluator: AsyncConditionEvaluator): void {
    asyncRegistry.set(key, evaluator);
}

/** Get all registered condition keys (sync + async). */
export function getRegisteredKeys(): string[] {
    return [...syncRegistry.keys(), ...asyncRegistry.keys()];
}

/**
 * Evaluate a single condition key.
 * Checks sync registry first, then async.
 * Returns undefined if key is not registered.
 */
export function evaluateSyncCondition(
    key: string,
    value: string,
    context: DirectiveContext,
): boolean | undefined {
    const evaluator = syncRegistry.get(key);
    if (evaluator) return evaluator(value, context);
    return undefined;
}

export async function evaluateAsyncCondition(
    key: string,
    value: string,
    context: DirectiveContext,
): Promise<boolean | undefined> {
    const evaluator = asyncRegistry.get(key);
    if (evaluator) return evaluator(value, context);
    return undefined;
}

/** Check if a key is registered in either registry. */
export function isRegisteredCondition(key: string): boolean {
    return syncRegistry.has(key) || asyncRegistry.has(key);
}

/** Check if a key requires async evaluation. */
export function isAsyncCondition(key: string): boolean {
    return asyncRegistry.has(key);
}
