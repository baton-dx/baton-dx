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
        } else if (d.type === "endif") {
            const top = stack.pop();
            if (top) {
                matched.push({
                    ifDirective: top.directive,
                    endifDirective: d,
                    depth: top.depth,
                });
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
 * Evaluate a single condition against the directive context.
 *
 * Only the FIRST recognized condition attribute is used.
 * Multiple condition attributes produce a warning.
 *
 * @returns true if the content should be KEPT, false if it should be REMOVED
 */
export function evaluateCondition(
    attributes: Record<string, string>,
    context: DirectiveContext,
    onWarning?: (message: string) => void,
): boolean {
    const conditionKeys = ["tool", "not-tool", "ide", "not-ide", "scope", "type"];
    const found = conditionKeys.filter((k) => k in attributes);

    if (found.length === 0) {
        onWarning?.("baton:if has no recognized condition attribute");
        return true; // fail-open
    }

    if (found.length > 1) {
        onWarning?.(
            `baton:if has multiple condition attributes (${found.join(", ")}), using first: ${found[0]}`,
        );
    }

    const key = found[0];
    const value = attributes[key];
    const values = value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);

    switch (key) {
        case "tool":
            return values.includes(context.currentTool);

        case "not-tool":
            return !values.includes(context.currentTool);

        case "ide":
            return values.some((v) => context.detectedIdes.includes(v));

        case "not-ide":
            return !values.some((v) => context.detectedIdes.includes(v));

        case "scope":
            return values.includes(context.scope);

        case "type":
            return values.includes(context.contentType);

        default:
            return true;
    }
}
