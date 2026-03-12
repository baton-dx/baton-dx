import { evaluateCondition, matchConditionalPairs } from "./conditional.js";
import { resolveInclude } from "./include.js";
import { parseDirectives } from "./parser.js";
import type { DirectiveOptions } from "./types.js";

/**
 * Regex to match any remaining baton:* HTML comment directives.
 * Used in the cleanup pass to strip leftover artifacts.
 */
const BATON_COMMENT_CLEANUP = /<!--\s*baton:[^>]*?-->\s*/g;

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
    let result = await resolveConditionals(content, options);

    // Phase 2: Re-parse and resolve includes (positions shifted after conditional removal)
    const directives = parseDirectives(result);
    const includes = directives.filter((d) => d.type === "include");

    if (includes.length > 0) {
        // Process in reverse document order so indices stay valid
        for (let i = includes.length - 1; i >= 0; i--) {
            const directive = includes[i];
            const replacement = await resolveInclude(
                directive,
                context.projectRoot,
                onWarning,
                context.profileRoot,
                context.profileName,
                options.onPlacement,
            );
            result =
                result.slice(0, directive.startIndex) +
                replacement +
                result.slice(directive.endIndex);
        }
    }

    // Phase 3: Cleanup — remove any remaining baton:* HTML comments (skip in explain mode)
    if (!options.explain) {
        result = result.replace(BATON_COMMENT_CLEANUP, "");
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
async function resolveConditionals(content: string, options: DirectiveOptions): Promise<string> {
    const { context, onWarning } = options;
    let result = content;

    if (options.explain) {
        return annotateConditionals(result, options);
    }

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
        const keep = await evaluateCondition(block.ifDirective.attributes, context, onWarning);

        if (block.elseDirective) {
            // if/else/endif block
            if (keep) {
                // Keep content between if and else
                const innerContent = result.slice(
                    block.ifDirective.endIndex,
                    block.elseDirective.startIndex,
                );
                result =
                    result.slice(0, block.ifDirective.startIndex) +
                    innerContent.trim() +
                    result.slice(block.endifDirective.endIndex);
            } else {
                // Keep content between else and endif
                const innerContent = result.slice(
                    block.elseDirective.endIndex,
                    block.endifDirective.startIndex,
                );
                result =
                    result.slice(0, block.ifDirective.startIndex) +
                    innerContent.trim() +
                    result.slice(block.endifDirective.endIndex);
            }
        } else if (keep) {
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

/**
 * Annotate conditional blocks with evaluation results instead of stripping them.
 * Replaces baton:if/else/endif comments with readable markers showing what was
 * included or excluded and why.
 */
async function annotateConditionals(content: string, options: DirectiveOptions): Promise<string> {
    const { context, onWarning } = options;
    let result = content;

    let safetyLimit = 100;
    while (safetyLimit-- > 0) {
        const directives = parseDirectives(result);
        const { matched } = matchConditionalPairs(directives, onWarning);

        if (matched.length === 0) break;

        const block = matched[0];
        const keep = await evaluateCondition(block.ifDirective.attributes, context, onWarning);

        // Build a readable condition summary from the attributes
        const conditionSummary = formatConditionAttributes(block.ifDirective.attributes);

        if (block.elseDirective) {
            const ifContent = result.slice(
                block.ifDirective.endIndex,
                block.elseDirective.startIndex,
            );
            const elseContent = result.slice(
                block.elseDirective.endIndex,
                block.endifDirective.startIndex,
            );

            const annotated = keep
                ? `\n>>> [INCLUDED] if ${conditionSummary} <<<\n${ifContent.trim()}\n>>> [EXCLUDED] else <<<\n${elseContent.trim()}\n>>> [END] <<<\n`
                : `\n>>> [EXCLUDED] if ${conditionSummary} <<<\n${ifContent.trim()}\n>>> [INCLUDED] else <<<\n${elseContent.trim()}\n>>> [END] <<<\n`;

            result =
                result.slice(0, block.ifDirective.startIndex) +
                annotated +
                result.slice(block.endifDirective.endIndex);
        } else if (keep) {
            const innerContent = result.slice(
                block.ifDirective.endIndex,
                block.endifDirective.startIndex,
            );
            result =
                result.slice(0, block.ifDirective.startIndex) +
                `\n>>> [INCLUDED] if ${conditionSummary} <<<\n${innerContent.trim()}\n>>> [END] <<<\n` +
                result.slice(block.endifDirective.endIndex);
        } else {
            const innerContent = result.slice(
                block.ifDirective.endIndex,
                block.endifDirective.startIndex,
            );
            result =
                result.slice(0, block.ifDirective.startIndex) +
                `\n>>> [EXCLUDED] if ${conditionSummary} <<<\n${innerContent.trim()}\n>>> [END] <<<\n` +
                result.slice(block.endifDirective.endIndex);
        }
    }

    return result;
}

/** Format condition attributes into a readable string like `tool="cursor" scope="project"` */
function formatConditionAttributes(attributes: Record<string, string>): string {
    return Object.entries(attributes)
        .map(([key, value]) => `${key}="${value}"`)
        .join(" ");
}
