import {
    evaluateAsyncCondition,
    evaluateSyncCondition,
    getRegisteredKeys,
    isAsyncCondition,
    isRegisteredCondition,
} from "./conditions/index.js";
import type { ConditionalBlock, DirectiveContext, ParsedDirective } from "./types.js";

/** Maximum nesting depth for conditional blocks */
const MAX_DEPTH = 5;

/**
 * Match baton:if directives with their corresponding baton:endif directives.
 *
 * Uses a stack-based approach: each `if` pushes onto the stack, each `endif` pops.
 * Unmatched directives are returned separately for warning purposes.
 *
 * @returns matched pairs sorted innermost-first (deepest depth first, then later position first)
 */
export function matchConditionalPairs(
    directives: ParsedDirective[],
    onWarning?: (message: string) => void,
): {
    matched: ConditionalBlock[];
    unmatchedIfs: ParsedDirective[];
    unmatchedEndifs: ParsedDirective[];
} {
    const stack: { directive: ParsedDirective; depth: number }[] = [];
    const matched: ConditionalBlock[] = [];
    const unmatchedEndifs: ParsedDirective[] = [];

    // Track else directives per stack depth
    const elseByDepth = new Map<number, ParsedDirective>();

    for (const d of directives) {
        if (d.type === "if") {
            const depth = stack.length;
            if (depth >= MAX_DEPTH) {
                onWarning?.(
                    `baton:if nesting depth exceeds maximum of ${MAX_DEPTH}, ignoring directive at index ${d.startIndex}`,
                );
                continue;
            }
            stack.push({ directive: d, depth });
        } else if (d.type === "else") {
            // Attach to the current innermost if block
            if (stack.length > 0) {
                const currentDepth = stack.length - 1;
                if (elseByDepth.has(currentDepth)) {
                    onWarning?.(`Duplicate baton:else at index ${d.startIndex}`);
                } else {
                    elseByDepth.set(currentDepth, d);
                }
            } else {
                onWarning?.(`Unmatched baton:else at index ${d.startIndex}`);
            }
        } else if (d.type === "endif") {
            const top = stack.pop();
            if (top) {
                matched.push({
                    ifDirective: top.directive,
                    elseDirective: elseByDepth.get(top.depth),
                    endifDirective: d,
                    depth: top.depth,
                });
                elseByDepth.delete(top.depth);
            } else {
                unmatchedEndifs.push(d);
                onWarning?.(`Unmatched baton:endif at index ${d.startIndex}`);
            }
        }
    }

    // Remaining items on the stack are unmatched ifs
    const unmatchedIfs = stack.map((s) => s.directive);
    for (const d of unmatchedIfs) {
        onWarning?.(`Unmatched baton:if at index ${d.startIndex}`);
    }

    // Sort innermost-first: higher depth first, then later position first (for same depth)
    matched.sort((a, b) => {
        if (b.depth !== a.depth) return b.depth - a.depth;
        return b.ifDirective.startIndex - a.ifDirective.startIndex;
    });

    return { matched, unmatchedIfs, unmatchedEndifs };
}

/**
 * Evaluate conditions against the directive context using AND-composition.
 *
 * ALL recognized condition attributes must pass for the result to be true.
 * OR logic is available within a single attribute via comma-separated values.
 * Supports both sync and async conditions via the condition registry.
 *
 * @returns true if the content should be KEPT, false if it should be REMOVED
 */
export async function evaluateCondition(
    attributes: Record<string, string>,
    context: DirectiveContext,
    onWarning?: (message: string) => void,
): Promise<boolean> {
    const registeredKeys = getRegisteredKeys();
    const found = registeredKeys.filter((k) => k in attributes);

    if (found.length === 0) {
        onWarning?.("baton:if has no recognized condition attribute");
        return true; // fail-open
    }

    // AND-composition: ALL conditions must pass
    for (const key of found) {
        let result: boolean | undefined;
        if (isAsyncCondition(key)) {
            result = await evaluateAsyncCondition(key, attributes[key], context);
        } else {
            result = evaluateSyncCondition(key, attributes[key], context);
        }
        if (result === false) return false;
    }

    return true;
}
