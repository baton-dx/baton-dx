import { defineCommand } from "citty";
import { idesListCommand } from "./list.js";
import { idesScanCommand } from "./scan.js";

export const idesCommand = defineCommand({
  meta: {
    name: "ides",
    description: "Manage IDE platform detection and configuration",
  },
  subCommands: {
    list: idesListCommand,
    scan: idesScanCommand,
  },
});
