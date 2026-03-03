import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { findSourceRoot } from "../../utils/context-detection.js";

/**
 * Recursively collect all file paths in a directory (relative to baseDir)
 */
async function collectFiles(dir: string, baseDir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath, baseDir)));
    } else {
      files.push(relative(baseDir, fullPath));
    }
  }

  return files;
}

/**
 * Remove a profile entry from baton.source.yaml if it exists in the profiles array
 */
async function removeProfileFromSourceManifest(
  sourceRoot: string,
  profileName: string,
): Promise<void> {
  const manifestPath = join(sourceRoot, "baton.source.yaml");

  try {
    const content = await readFile(manifestPath, "utf-8");
    const manifest = parseYaml(content);

    if (manifest?.profiles && Array.isArray(manifest.profiles)) {
      const originalLength = manifest.profiles.length;
      manifest.profiles = manifest.profiles.filter(
        (profile: { name?: string; path?: string }) =>
          profile.name !== profileName && profile.path !== `profiles/${profileName}`,
      );

      if (manifest.profiles.length < originalLength) {
        // Remove empty profiles array
        if (manifest.profiles.length === 0) {
          manifest.profiles = undefined;
        }
        await writeFile(manifestPath, stringifyYaml(manifest), "utf-8");
      }
    }
  } catch {
    // If manifest can't be read/written, skip — the directory removal is the primary action
  }
}

export const profileRemoveCommand = defineCommand({
  meta: {
    name: "remove",
    description: "Remove a profile from the source repository",
  },
  args: {
    name: {
      type: "positional",
      description: "Profile name to remove",
      required: true,
    },
  },
  async run({ args }) {
    p.intro("Remove Profile");

    // Check for baton.source.yaml in current or parent directories
    const sourceRoot = await findSourceRoot();
    if (!sourceRoot) {
      p.cancel("This command must be run inside a source directory (baton.source.yaml not found)");
      process.exit(1);
    }

    const profileName = args.name as string;
    const profileDir = join(sourceRoot, "profiles", profileName);

    // Check if profile directory exists
    let files: string[];
    try {
      files = await collectFiles(profileDir, sourceRoot);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        p.cancel(`Profile "${profileName}" does not exist in profiles/${profileName}/`);
        process.exit(1);
      }
      throw error;
    }

    // Warn about files that will be deleted
    if (files.length > 0) {
      p.log.warn("The following files will be deleted:");
      for (const file of files) {
        p.log.info(`  ${file}`);
      }
    } else {
      p.log.warn(`Directory profiles/${profileName}/ will be deleted.`);
    }

    // Confirm before removing
    const confirmed = await p.confirm({
      message: `Are you sure you want to remove profile "${profileName}"?`,
      initialValue: false,
    });

    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }

    // Remove the profile directory
    await rm(profileDir, { recursive: true, force: true });

    // Remove entry from baton.source.yaml if present
    await removeProfileFromSourceManifest(sourceRoot, profileName);

    p.outro(`Profile "${profileName}" removed from profiles/${profileName}/`);
  },
});
