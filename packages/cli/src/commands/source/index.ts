import { defineCommand } from "citty";
import { connectCommand } from "./connect.js";
import { sourceCreateCommand } from "./create.js";
import { disconnectCommand } from "./disconnect.js";
import { listCommand } from "./list.js";
import { validateCommand } from "./validate.js";

export const sourceCommand = defineCommand({
  meta: {
    name: "source",
    description: "Manage source repositories (create, list, connect, disconnect, validate)",
  },
  subCommands: {
    create: sourceCreateCommand,
    list: listCommand,
    connect: connectCommand,
    disconnect: disconnectCommand,
    validate: validateCommand,
  },
});
