import { evaluateCondition, matchConditionalPairs } from "./conditional.js";
import { resolveInclude } from "./include.js";
import { parseDirectives } from "./parser.js";
import type { DirectiveOptions } from "./types.js";

/**
 * Process all baton directives in content.
 *
 * Pipeline: parse → match conditionals → resolve conditionals (innermost-first)
 *         → re-parse → resolve includes (reverse document order)
 *
 * @param content - Raw markdown/text content
 * @param options - Directive context and callbacks
 * @returns Processed content with directives resolved
 */
export async function processDirectives(
    content: string,
    options: DirectiveOptions,
): Promise<string> {
    // Fast path: skip processing if no directives present
    if (!content.includes("baton:")) {
        return content;
    }

    const { context, onWarning } = options;

    // Phase 1: Resolve conditionals
    let result = resolveConditionals(content, options);

    // Phase 2: Re-parse and resolve includes (positions shifted after conditional removal)
    const directives = parseDirectives(result);
    const includes = directives.filter((d) => d.type === "include");

    if (includes.length > 0) {
        // Process in reverse document order so indices stay valid
        for (let i = includes.length - 1; i >= 0; i--) {
            const directive = includes[i];
            const replacement = await resolveInclude(directive, context.projectRoot, onWarning);
            result =
                result.slice(0, directive.startIndex) +
                replacement +
                result.slice(directive.endIndex);
        }
    }

    return result;
}

/**
 * Resolve all conditional blocks in content.
 *
 * Processes innermost blocks first so nested conditionals work correctly.
 * Unmatched baton:if → content kept (fail-open).
 * Unmatched baton:endif → left in place.
 */
function resolveConditionals(content: string, options: DirectiveOptions): string {
    const { context, onWarning } = options;
    let result = content;

    // We need to iterate because after removing a block, positions shift
    // and we need to re-parse. matchConditionalPairs returns innermost-first,
    // but we process one at a time and re-parse.
    let safetyLimit = 100;
    while (safetyLimit-- > 0) {
        const directives = parseDirectives(result);
        const { matched } = matchConditionalPairs(directives, onWarning);

        if (matched.length === 0) break;

        // Process the first (innermost) matched pair
        const block = matched[0];
        const keep = evaluateCondition(block.ifDirective.attributes, context, onWarning);

        if (keep) {
            // Keep content between if and endif, remove the directive tags
            const innerContent = result.slice(
                block.ifDirective.endIndex,
                block.endifDirective.startIndex,
            );
            result =
                result.slice(0, block.ifDirective.startIndex) +
                innerContent.trim() +
                result.slice(block.endifDirective.endIndex);
        } else {
            // Remove the entire block (if tag + content + endif tag)
            result =
                result.slice(0, block.ifDirective.startIndex) +
                result.slice(block.endifDirective.endIndex);
        }
    }

    return result;
}
