import { runAuthDiagnostic } from "@baton-dx/core";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";

const METHOD_LABELS: Record<string, string> = {
    env: "Environment variable",
    "git-credential": "Git credential helper",
    "gh-cli": "GitHub CLI (gh)",
    ssh: "SSH connectivity",
};

export const authStatusCommand = defineCommand({
    meta: {
        name: "status",
        description: "Diagnose authentication for private source repositories",
    },
    args: {
        hostname: {
            type: "string",
            description: "Hostname to test auth for (default: github.com)",
            default: "github.com",
        },
    },
    async run({ args }) {
        const hostname = args.hostname || "github.com";

        p.intro(`Auth Status for ${hostname}`);

        const spinner = p.spinner();
        spinner.start("Running auth cascade...");

        const steps = await runAuthDiagnostic(hostname);

        spinner.stop("Auth cascade complete");

        console.log("");

        const activeMethod = steps.find((s) => s.success);

        for (const step of steps) {
            const icon = step.success ? "✓" : "✗";
            const label = METHOD_LABELS[step.method] ?? step.method;
            const line = `  ${icon} ${label.padEnd(24)} ${step.detail}`;
            if (step.success) {
                p.log.success(line);
            } else {
                p.log.info(line);
            }
        }

        console.log("");
        if (activeMethod) {
            p.log.success(
                `Active method: ${activeMethod.method} (${METHOD_LABELS[activeMethod.method] ?? activeMethod.method})`,
            );
        } else {
            p.log.error("No authentication method available.");
        }

        // Show tips
        const isGitHub = hostname === "github.com" || hostname.endsWith(".github.com");
        const hasGhCli = steps.some((s) => s.method === "gh-cli" && s.success);
        const hasCredential = steps.some((s) => s.method === "git-credential" && s.success);

        if (isGitHub && hasGhCli && !hasCredential) {
            console.log("");
            p.log.info("Tip: Run `gh auth setup-git` to register gh as a git credential helper.");
        }

        p.outro("");
    },
});
