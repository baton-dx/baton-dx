import { registerCondition, splitValues } from "./registry.js";

registerCondition("tool", (value, context) => {
    return splitValues(value).includes(context.currentTool);
});

registerCondition("not-tool", (value, context) => {
    return !splitValues(value).includes(context.currentTool);
});
