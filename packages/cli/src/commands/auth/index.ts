import { defineCommand } from "citty";
import { authStatusCommand } from "./status.js";

export const authCommand = defineCommand({
    meta: {
        name: "auth",
        description: "Authentication diagnostics and management",
    },
    subCommands: {
        status: authStatusCommand,
    },
});
