import { resolve } from "node:path";
import { validateSource } from "@baton-dx/core";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";

export const validateCommand = defineCommand({
  meta: {
    name: "validate",
    description: "Validate a source repository structure and manifests",
  },
  args: {
    path: {
      type: "positional",
      description: "Path to source repository (defaults to current directory)",
      required: false,
    },
  },
  async run({ args }) {
    const sourceRoot = resolve(args.path ? String(args.path) : process.cwd());

    p.intro("Validating source repository");

    const spinner = p.spinner();
    spinner.start("Running validation checks...");

    const report = await validateSource(sourceRoot);

    spinner.stop("Validation complete");

    // Display issues
    for (const issue of report.issues) {
      if (issue.severity === "error") {
        p.log.error(issue.message);
      } else {
        p.log.warn(issue.message);
      }
    }

    // Summary
    const summaryLines = [
      `Errors: ${report.summary.errors}`,
      `Warnings: ${report.summary.warnings}`,
      `Profiles checked: ${report.summary.profilesChecked}`,
    ];
    p.note(summaryLines.join("\n"), "Result");

    if (report.valid && report.summary.warnings === 0) {
      p.outro("Source is valid");
    } else if (report.valid) {
      p.outro("Source is valid (with warnings)");
    } else {
      p.outro("Source has errors");
      process.exit(1);
    }
  },
});
