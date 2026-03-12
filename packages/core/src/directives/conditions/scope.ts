import { registerCondition, splitValues } from "./registry.js";

registerCondition("scope", (value, context) => {
    return splitValues(value).includes(context.scope);
});
