import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getAllAIToolAdapters } from "../adapters/registry.js";
import { getIdePlatformTargetDir, getRegisteredIdePlatforms } from "../ide/platform-registry.js";

/**
 * Extract directory from a dynamic path and add it as a pattern.
 * For static paths (no `_probe` placeholder resolved), adds the file itself.
 *
 * E.g. ".claude/commands/_probe.md" -> ".claude/commands/"  (dynamic)
 * E.g. ".github/copilot-instructions.md" -> ".github/copilot-instructions.md"  (static)
 */
function addDirPattern(patterns: Set<string>, path: string): void {
  const lastSlash = path.lastIndexOf("/");
  if (lastSlash > 0) {
    if (path.includes("_probe")) {
      patterns.add(path.substring(0, lastSlash + 1));
    } else {
      // Static path (no {name} placeholder) — add the file itself, not the parent dir
      patterns.add(path);
    }
  }
}

/**
 * Add a path pattern. Dynamic paths (containing `_probe`) are reduced to their
 * directory; static paths and root-level files are added as-is.
 *
 * E.g. ".claude/rules/_probe.md" -> ".claude/rules/"  (dynamic)
 * E.g. ".github/copilot-instructions.md" -> ".github/copilot-instructions.md"  (static)
 * E.g. "CLAUDE.md" -> "CLAUDE.md"  (root file)
 */
function addPathPattern(patterns: Set<string>, path: string): void {
  const lastSlash = path.lastIndexOf("/");
  if (lastSlash > 0) {
    if (path.includes("_probe")) {
      patterns.add(path.substring(0, lastSlash + 1));
    } else {
      // Static path (e.g. .github/copilot-instructions.md) — add the file itself
      patterns.add(path);
    }
  } else if (path) {
    patterns.add(path);
  }
}

/**
 * Ensures `.baton/` is listed in the project's .gitignore.
 *
 * Uses the same "# Baton local" format as `baton init`.
 * Idempotent: no-op if `.baton/` is already present (by any mechanism).
 */
export async function ensureBatonDirGitignored(projectRoot: string): Promise<void> {
  const gitignorePath = join(projectRoot, ".gitignore");

  let content = "";
  try {
    content = await readFile(gitignorePath, "utf-8");
  } catch {
    // .gitignore doesn't exist yet
  }

  if (content.includes(".baton/")) {
    return;
  }

  const newContent = content
    ? `${content.trimEnd()}\n\n# Baton local\n.baton/\n`
    : "# Baton local\n.baton/\n";
  await writeFile(gitignorePath, newContent, "utf-8");
}

const BATON_SECTION_START = "# Baton managed";
const BATON_SECTION_END = "# End Baton managed";

/**
 * Update .gitignore with patterns for baton-managed files.
 *
 * Manages a dedicated "# Baton managed" section in .gitignore.
 * Idempotent: re-running with the same patterns produces no changes.
 */
export async function updateGitignore(projectRoot: string, patterns: string[]): Promise<boolean> {
  if (patterns.length === 0) return false;

  const gitignorePath = join(projectRoot, ".gitignore");

  let content = "";
  try {
    content = await readFile(gitignorePath, "utf-8");
  } catch {
    // .gitignore doesn't exist yet
  }

  const sectionContent = patterns.join("\n");
  const newSection = `${BATON_SECTION_START}\n${sectionContent}\n${BATON_SECTION_END}`;

  // Check if section already exists
  const startIdx = content.indexOf(BATON_SECTION_START);
  const endIdx = content.indexOf(BATON_SECTION_END);

  let newContent: string;

  if (startIdx !== -1 && endIdx !== -1) {
    // Replace existing section
    const existingSection = content.substring(startIdx, endIdx + BATON_SECTION_END.length);
    if (existingSection === newSection) {
      // No changes needed
      return false;
    }
    newContent =
      content.substring(0, startIdx) +
      newSection +
      content.substring(endIdx + BATON_SECTION_END.length);
  } else {
    // Append new section
    newContent = content ? `${content.trimEnd()}\n\n${newSection}\n` : `${newSection}\n`;
  }

  await writeFile(gitignorePath, newContent, "utf-8");
  return true;
}

/**
 * Remove the "# Baton managed ... # End Baton managed" section from .gitignore.
 *
 * Used when the project has `gitignore: false` to clean up any previously
 * written managed section.
 *
 * @returns true if a section was removed, false if none existed
 */
export async function removeGitignoreManagedSection(projectRoot: string): Promise<boolean> {
  const gitignorePath = join(projectRoot, ".gitignore");

  let content = "";
  try {
    content = await readFile(gitignorePath, "utf-8");
  } catch {
    return false;
  }

  const startIdx = content.indexOf(BATON_SECTION_START);
  const endIdx = content.indexOf(BATON_SECTION_END);

  if (startIdx === -1 || endIdx === -1) {
    return false;
  }

  const before = content.substring(0, startIdx).replace(/\n+$/, "\n");
  const after = content.substring(endIdx + BATON_SECTION_END.length).replace(/^\n+/, "\n");
  const newContent = (before + after).trim();

  await writeFile(gitignorePath, newContent ? `${newContent}\n` : "", "utf-8");
  return true;
}

/**
 * Parameters for collecting comprehensive gitignore patterns.
 */
export interface CollectComprehensivePatternsOptions {
  /** File targets placed by sync (from profile manifests, e.g. "biome.json") */
  fileTargets: string[];
}

/**
 * Collect comprehensive gitignore patterns for ALL known AI tools and IDE platforms.
 *
 * Generates patterns for the entire tool and IDE registry, ensuring stable,
 * predictable .gitignore content regardless of which tools a profile supports
 * or a developer has installed.
 *
 * Returns deduplicated, sorted patterns including baton.lock.
 */
export function collectComprehensivePatterns(
  options: CollectComprehensivePatternsOptions,
): string[] {
  const patterns = new Set<string>();
  const { fileTargets } = options;

  // AI tool patterns: directories, memory files, and legacy paths for ALL known adapters
  const allAdapters = getAllAIToolAdapters();
  for (const adapter of allAdapters) {
    const commandPath = adapter.getPath("commands", "project", "_probe");
    addDirPattern(patterns, commandPath);

    const skillPath = adapter.getPath("skills", "project", "_probe");
    addDirPattern(patterns, skillPath);

    const rulePath = adapter.getPath("rules", "project", "_probe");
    addPathPattern(patterns, rulePath);

    const memoryPath = adapter.getPath("memory", "project", "_probe");
    addPathPattern(patterns, memoryPath);

    const agentPath = adapter.getPath("agents", "project", "_probe");
    addDirPattern(patterns, agentPath);

    for (const legacyPath of adapter.getLegacyPaths("rules")) {
      patterns.add(legacyPath);
    }
  }

  // IDE patterns: directories for ALL known IDE platforms
  const allIdePlatforms = getRegisteredIdePlatforms();
  for (const ideKey of allIdePlatforms) {
    const targetDir = getIdePlatformTargetDir(ideKey);
    if (targetDir) {
      const dir = targetDir.endsWith("/") ? targetDir : `${targetDir}/`;
      patterns.add(dir);
    }
  }

  // File targets from profiles
  for (const target of fileTargets) {
    patterns.add(target);
  }

  // Always include baton.lock
  patterns.add("baton.lock");

  return [...patterns].sort();
}
