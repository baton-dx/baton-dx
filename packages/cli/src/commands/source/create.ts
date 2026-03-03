import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { KEBAB_CASE_REGEX } from "@baton-dx/core";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import Handlebars from "handlebars";
import simpleGit from "simple-git";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface WizardOptions {
    name: string;
    git: boolean;
    withInitialProfile: boolean;
}

interface WizardOverrides {
    name?: string;
    git?: boolean;
    withInitialProfile?: boolean;
}

async function runInteractiveWizard(overrides: WizardOverrides = {}): Promise<WizardOptions> {
    p.intro("Create a new Baton source repository");

    // 1. Name (with validation)
    let name: string;
    if (overrides.name) {
        name = overrides.name;
    } else {
        const result = await p.text({
            message: "What is the name of your source repository?",
            placeholder: "my-team-profile",
            validate: (value) => {
                if (!value) return "Name is required";
                if (!KEBAB_CASE_REGEX.test(value))
                    return "Name must be in kebab-case (lowercase, hyphens only)";
            },
        });
        if (p.isCancel(result)) {
            p.cancel("Operation cancelled.");
            process.exit(0);
        }
        name = String(result);
    }

    // 2. Git Initialization
    let git: boolean;
    if (overrides.git !== undefined) {
        git = overrides.git;
    } else {
        const result = (await p.confirm({
            message: "Initialize Git repository?",
            initialValue: true,
        })) as boolean;
        if (p.isCancel(result)) {
            p.cancel("Operation cancelled.");
            process.exit(0);
        }
        git = result;
    }

    // 3. Initial Profile
    let withInitialProfile: boolean;
    if (overrides.withInitialProfile !== undefined) {
        withInitialProfile = overrides.withInitialProfile;
    } else {
        const result = (await p.confirm({
            message: "Create initial profile in profiles/default/?",
            initialValue: true,
        })) as boolean;
        if (p.isCancel(result)) {
            p.cancel("Operation cancelled.");
            process.exit(0);
        }
        withInitialProfile = result;
    }

    return {
        name,
        git,
        withInitialProfile,
    };
}

/**
 * Recursively copy a directory and apply Handlebars variable substitution to text files
 */
async function copyDirectory(
    src: string,
    dest: string,
    variables: Record<string, unknown>,
): Promise<void> {
    await mkdir(dest, { recursive: true });

    const entries = await readdir(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = join(src, entry.name);
        const destPath = join(dest, entry.name);

        if (entry.isDirectory()) {
            await copyDirectory(srcPath, destPath, variables);
        } else if (entry.isFile()) {
            const content = await readFile(srcPath, "utf-8");

            // Binary file detection (skip substitution for binary files)
            const binaryExtensions = new Set([
                ".png",
                ".jpg",
                ".jpeg",
                ".gif",
                ".ico",
                ".woff",
                ".woff2",
                ".ttf",
                ".eot",
            ]);
            const isBinary = binaryExtensions.has(
                entry.name.substring(entry.name.lastIndexOf(".")),
            );

            if (isBinary) {
                await writeFile(destPath, content);
            } else {
                // Substitute variables with Handlebars
                const template = Handlebars.compile(content, { noEscape: true });
                const substituted = template(variables);
                await writeFile(destPath, substituted);
            }
        }
    }
}

/**
 * Initialize Git repository and create initial commit
 */
async function initializeGit(targetDir: string): Promise<void> {
    const git = simpleGit(targetDir);

    // Initialize repository
    await git.init();

    // Add all files
    await git.add(".");

    // Create initial commit
    await git.commit("Initial baton source setup");
}

/**
 * Generate README.md with next steps
 */
async function generateReadme(targetDir: string, options: WizardOptions): Promise<void> {
    const { name, withInitialProfile } = options;
    const org = name.includes("-") ? name.split("-")[0] : name;

    const readmeContent = `# ${name}

Baton source repository.

## Usage

Add profiles from this source repository to your project:

\`\`\`bash
# From GitHub (after you push)
baton init --profile github:${org}/${name}/profiles/default

# Or locally (for testing)
baton init --profile file:./${name}/profiles/default
\`\`\`

## Next Steps

1. **Customize your profiles:**
   - Edit \`baton.source.yaml\` to configure the source metadata
   - Modify profiles in \`profiles/*/baton.profile.yaml\`
   - Add project-specific configurations to \`profiles/*/files/\`
   - Customize AI tool configs in \`profiles/*/ai/\`

2. **Create additional profiles:**
   \`\`\`bash
   cd ${name}
   baton profile create frontend
   baton profile create backend
   \`\`\`

3. **Set up Git remote:**
   \`\`\`bash
   git remote add origin https://github.com/${org}/${name}.git
   git push -u origin main
   \`\`\`

4. **Share with your team:**
   - Publish to GitHub for team-wide access
   - Team members can use: \`baton init --profile github:${org}/${name}/profiles/default\`

## Structure

- \`baton.source.yaml\` - Source repository manifest
- \`profiles/\` - Container for all profiles
${withInitialProfile ? "  - `profiles/default/` - Default profile\n    - `baton.profile.yaml` - Profile manifest\n    - `ai/` - AI tool configurations\n    - `files/` - Dotfiles and configs to sync\n    - `ide/` - IDE settings\n" : ""}
## Learn More

- [Baton Documentation](https://github.com/baton-dx/baton)
- [Source Schema](https://github.com/baton-dx/baton/blob/main/docs/source-schema.md)
- [Profile Schema](https://github.com/baton-dx/baton/blob/main/docs/profile-schema.md)

---

Generated with \`baton source create\`
`;

    await writeFile(join(targetDir, "README.md"), readmeContent);
}

/**
 * Scaffold a source repository
 */
export async function scaffoldSourceRepo(options: WizardOptions): Promise<string> {
    const { name, git, withInitialProfile } = options;

    // Target directory is always ./<name>
    const targetDir = join(process.cwd(), name);

    // Create base directory and profiles/ folder
    await mkdir(join(targetDir, "profiles"), { recursive: true });

    // Create baton.source.yaml
    const sourceManifest = `name: "${name}"
version: "0.1.0"
description: "Baton source repository"

${
    withInitialProfile
        ? `profiles:
  - name: "default"
    path: "profiles/default"
    description: "Default profile configuration"
`
        : ""
}
metadata:
  created: "${new Date().getFullYear()}"
`;
    await writeFile(join(targetDir, "baton.source.yaml"), sourceManifest);

    // Create initial profile if requested
    if (withInitialProfile) {
        const profileDir = join(targetDir, "profiles", "default");
        await mkdir(profileDir, { recursive: true });

        // Copy minimal profile template
        const profileTemplateDir = join(__dirname, "templates", "profile", "minimal");
        await copyDirectory(profileTemplateDir, profileDir, { name: "default" });
    }

    // Generate README.md
    await generateReadme(targetDir, options);

    // Initialize Git if requested
    if (git) {
        await initializeGit(targetDir);
    }

    return targetDir;
}

export const sourceCreateCommand = defineCommand({
    meta: {
        name: "source create",
        description: "Create a new source repository with an interactive wizard",
    },
    args: {
        name: {
            type: "positional",
            description: "Name of the source repository (kebab-case)",
            required: false,
        },
        yes: {
            type: "boolean",
            description: "Skip interactive wizard and use defaults",
            default: false,
        },
    },
    async run({ args }) {
        const providedName = args.name as string | undefined;
        const yesArg = args.yes as boolean | undefined;

        // Validate name if provided
        if (providedName && !KEBAB_CASE_REGEX.test(providedName)) {
            console.error("Error: Name must be in kebab-case (lowercase, hyphens only)");
            process.exit(1);
        }

        // Build overrides from CLI args
        const overrides: WizardOverrides = {
            name: providedName || undefined,
        };

        // If --yes flag: fill in defaults for anything not provided
        if (yesArg) {
            overrides.name = overrides.name || "my-source";
            overrides.git = true;
            overrides.withInitialProfile = false;
        }

        // Run wizard (skips steps where overrides are provided)
        const options = await runInteractiveWizard(overrides);

        // Scaffold the source repository
        const spinner = p.spinner();
        spinner.start("Creating source repository...");

        try {
            const targetDir = await scaffoldSourceRepo(options);
            spinner.stop(`Source repository created at ${targetDir}`);

            // Build summary message
            const features: string[] = [];
            if (options.withInitialProfile) {
                features.push("Initial Profile: profiles/default/");
            }
            if (options.git) {
                features.push("Git: Initialized with initial commit");
            }

            if (features.length > 0) {
                p.note(features.join("\n"), "Features");
            }

            const org = options.name.includes("-") ? options.name.split("-")[0] : options.name;
            const nextSteps: string[] = [];
            nextSteps.push(`  cd ${options.name}`);
            nextSteps.push("  # Customize your profile (see README.md)");
            if (options.git) {
                nextSteps.push(
                    `  git remote add origin https://github.com/${org}/${options.name}.git`,
                );
                nextSteps.push("  git push -u origin main");
            }
            nextSteps.push("");
            nextSteps.push("  # Share with your team:");
            nextSteps.push(`  baton source connect https://github.com/${org}/${options.name}.git`);

            p.outro(
                `Source repository "${options.name}" created successfully!\n\nNext steps:\n${nextSteps.join("\n")}`,
            );
        } catch (error) {
            spinner.stop("Failed to create source repository");
            throw error;
        }
    },
});
