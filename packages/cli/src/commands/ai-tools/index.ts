import { defineCommand } from "citty";
import { aiToolsConfigureCommand } from "./configure.js";
import { aiToolsListCommand } from "./list.js";
import { aiToolsScanCommand } from "./scan.js";

export const aiToolsCommand = defineCommand({
  meta: {
    name: "ai-tools",
    description: "Manage AI tool detection and configuration",
  },
  subCommands: {
    configure: aiToolsConfigureCommand,
    list: aiToolsListCommand,
    scan: aiToolsScanCommand,
  },
});
