import { defineCommand } from "citty";

export const profileCommand = defineCommand({
    meta: {
        name: "profile",
        description: "Manage profiles (create, list, remove)",
    },
    subCommands: {
        create: () => import("./create.js").then((m) => m.createCommand),
        list: () => import("./list.js").then((m) => m.profileListCommand),
        remove: () => import("./remove.js").then((m) => m.profileRemoveCommand),
    },
});
