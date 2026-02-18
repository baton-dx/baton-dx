import { defineCommand } from "citty";
import { aiToolsListCommand } from "./list.js";
import { aiToolsScanCommand } from "./scan.js";

export const aiToolsCommand = defineCommand({
  meta: {
    name: "ai-tools",
    description: "Manage AI tool detection and configuration",
  },
  subCommands: {
    list: aiToolsListCommand,
    scan: aiToolsScanCommand,
  },
});
