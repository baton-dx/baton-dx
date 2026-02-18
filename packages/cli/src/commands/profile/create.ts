import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { KEBAB_CASE_REGEX } from "@baton-dx/core";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import Handlebars from "handlebars";
import { findSourceRoot } from "../../utils/context-detection.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const createCommand = defineCommand({
  meta: {
    name: "create",
    description: "Create a new profile in your source repository",
  },
  args: {
    name: {
      type: "positional",
      description: "Profile name (kebab-case)",
      required: false,
    },
  },
  async run({ args }) {
    p.intro("Create Profile");

    // Check for baton.source.yaml in current or parent directories
    const sourceRoot = await findSourceRoot();
    if (!sourceRoot) {
      p.cancel("This command must be run inside a source directory (baton.source.yaml not found)");
      process.exit(1);
    }

    // Get profile name — from argument or wizard prompt
    let name = args.name as string | undefined;

    if (!name) {
      const nameInput = await p.text({
        message: "Profile name (kebab-case)",
        placeholder: "e.g., backend, frontend, my-profile",
        validate(value) {
          if (!value || value.trim().length === 0) {
            return "Profile name is required";
          }
          if (!KEBAB_CASE_REGEX.test(value.trim())) {
            return "Profile name must be in kebab-case (e.g., my-profile, backend, frontend)";
          }
        },
      });

      if (p.isCancel(nameInput)) {
        p.cancel("Cancelled.");
        process.exit(0);
      }

      name = (nameInput as string).trim();
    }

    // Validate name format (kebab-case)
    if (!KEBAB_CASE_REGEX.test(name)) {
      p.cancel("Profile name must be in kebab-case (e.g., my-profile, backend, frontend)");
      process.exit(1);
    }

    // Check if profile already exists in profiles/ directory
    const targetDir = join(sourceRoot, "profiles", name);
    try {
      await readdir(targetDir);
      p.cancel(`Profile '${name}' already exists in profiles/${name}/`);
      process.exit(1);
    } catch {
      // Directory doesn't exist - good to proceed
    }

    // Create profile directory
    await mkdir(targetDir, { recursive: true });

    // Copy minimal template files
    const templateDir = join(__dirname, "templates", "profile", "minimal");
    await copyProfileTemplate(templateDir, targetDir, { name });

    p.outro(`Profile '${name}' created in profiles/${name}/`);
  },
});

/**
 * Recursively copy profile template with variable substitution
 */
async function copyProfileTemplate(
  sourceDir: string,
  targetDir: string,
  variables: { name: string },
): Promise<void> {
  const entries = await readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = join(sourceDir, entry.name);
    const targetPath = join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await mkdir(targetPath, { recursive: true });
      await copyProfileTemplate(sourcePath, targetPath, variables);
    } else {
      // Read file content
      const content = await readFile(sourcePath, "utf-8");

      // Apply Handlebars substitution for text files
      const processed = Handlebars.compile(content, { noEscape: true })(variables);

      // Write processed content
      await writeFile(targetPath, processed, "utf-8");
    }
  }
}
