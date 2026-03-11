import { registerCondition, splitValues } from "./registry.js";

registerCondition("ide", (value, context) => {
    return splitValues(value).some((v) => context.detectedIdes.includes(v));
});

registerCondition("not-ide", (value, context) => {
    return !splitValues(value).some((v) => context.detectedIdes.includes(v));
});
