import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { registerAsyncCondition, splitValues } from "./registry.js";

registerAsyncCondition("file", async (value, context) => {
    const files = splitValues(value);
    for (const file of files) {
        try {
            await access(resolve(context.projectRoot, file));
            return true; // OR: any file exists → pass
        } catch {
            // file doesn't exist, continue
        }
    }
    return false;
});

registerAsyncCondition("not-file", async (value, context) => {
    const files = splitValues(value);
    for (const file of files) {
        try {
            await access(resolve(context.projectRoot, file));
            return false; // any file exists → fail
        } catch {
            // file doesn't exist, continue
        }
    }
    return true; // none exist → pass
});
