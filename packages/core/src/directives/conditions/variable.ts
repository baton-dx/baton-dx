import { registerCondition, splitValues } from "./registry.js";

/**
 * Variable conditions check against context.variables from baton.yaml.
 *
 * Syntax:
 * - `var="lang"` → true if variable "lang" is defined (any value)
 * - `var="lang:typescript"` → true if variable "lang" equals "typescript"
 * - `var="lang:typescript,lang:rust"` → true if lang is typescript OR rust
 */
registerCondition("var", (value, context) => {
    const variables = context.variables ?? {};
    const entries = splitValues(value);

    return entries.some((entry) => {
        const colonIndex = entry.indexOf(":");
        if (colonIndex === -1) {
            // Just check existence
            return entry in variables;
        }
        const varName = entry.slice(0, colonIndex);
        const varValue = entry.slice(colonIndex + 1);
        return variables[varName] === varValue;
    });
});

registerCondition("not-var", (value, context) => {
    const variables = context.variables ?? {};
    const entries = splitValues(value);

    // not-var passes if NONE of the entries match
    return !entries.some((entry) => {
        const colonIndex = entry.indexOf(":");
        if (colonIndex === -1) {
            return entry in variables;
        }
        const varName = entry.slice(0, colonIndex);
        const varValue = entry.slice(colonIndex + 1);
        return variables[varName] === varValue;
    });
});
