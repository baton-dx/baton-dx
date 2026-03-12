import { detectHas } from "./has-registry.js";
import { registerAsyncCondition, splitValues } from "./registry.js";

registerAsyncCondition("has", async (value, context) => {
    const keys = splitValues(value);
    // OR: any characteristic present → pass
    for (const key of keys) {
        const result = await detectHas(context.projectRoot, key);
        if (result === true) return true;
        // Unknown key → skip (doesn't contribute to match)
    }
    return false;
});

registerAsyncCondition("not-has", async (value, context) => {
    const keys = splitValues(value);
    // not-has passes if NONE of the characteristics are present
    for (const key of keys) {
        const result = await detectHas(context.projectRoot, key);
        if (result === true) return false;
    }
    return true;
});
