import { defineCommand } from "citty";
import { idesConfigureCommand } from "./configure.js";
import { idesListCommand } from "./list.js";
import { idesScanCommand } from "./scan.js";

export const idesCommand = defineCommand({
  meta: {
    name: "ides",
    description: "Manage IDE platform detection and configuration",
  },
  subCommands: {
    configure: idesConfigureCommand,
    list: idesListCommand,
    scan: idesScanCommand,
  },
});
