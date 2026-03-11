import { registerCondition, splitValues } from "./registry.js";

registerCondition("type", (value, context) => {
    return splitValues(value).includes(context.contentType);
});
