import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getAllAIToolAdapters } from "../adapters/registry.js";
import { getIdePlatformTargetDir, getRegisteredIdePlatforms } from "../ide/platform-registry.js";
import { atomicWriteFile } from "./atomic-write.js";

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
  await atomicWriteFile(gitignorePath, newContent);
}

const BATON_SECTION_START = "# Baton managed";
const BATON_SECTION_END = "# End Baton managed";

/**
 * A labeled group of gitignore patterns rendered as a `## label` block
 * inside the Baton managed section.
 */
export interface GitignoreSection {
  label: string;
  patterns: string[];
}

/**
 * Update .gitignore with patterns for baton-managed files.
 *
 * Manages a dedicated "# Baton managed" section in .gitignore.
 * Idempotent: re-running with the same patterns produces no changes.
 */
export async function updateGitignore(projectRoot: string, patterns: string[]): Promise<boolean> {
  if (patterns.length === 0) return false;
  return updateGitignoreContent(projectRoot, patterns.join("\n"));
}

/**
 * Update .gitignore with categorized sections inside the Baton managed block.
 *
 * Each section is rendered with a `## label` header and an empty line separator.
 * Empty sections are omitted. Idempotent.
 *
 * Example output:
 * ```
 * # Baton managed
 *
 * ## ai-tools
 * .claude/
 * .cursor/
 *
 * ## ides
 * .vscode/
 *
 * # End Baton managed
 * ```
 */
export async function updateGitignoreWithSections(
  projectRoot: string,
  sections: GitignoreSection[],
): Promise<boolean> {
  const nonEmpty = sections.filter((s) => s.patterns.length > 0);
  if (nonEmpty.length === 0) return false;

  const sectionContent = nonEmpty
    .map((s) => `## ${s.label}\n${s.patterns.join("\n")}`)
    .join("\n\n");

  return updateGitignoreContent(projectRoot, `\n${sectionContent}\n`);
}

/**
 * Shared implementation: write/replace the Baton managed block.
 */
async function updateGitignoreContent(projectRoot: string, inner: string): Promise<boolean> {
  const gitignorePath = join(projectRoot, ".gitignore");

  let content = "";
  try {
    content = await readFile(gitignorePath, "utf-8");
  } catch {
    // .gitignore doesn't exist yet
  }

  const newSection = `${BATON_SECTION_START}\n${inner}\n${BATON_SECTION_END}`;

  const startIdx = content.indexOf(BATON_SECTION_START);
  const endIdx = content.indexOf(BATON_SECTION_END);

  let newContent: string;

  if (startIdx !== -1 && endIdx !== -1) {
    const existingSection = content.substring(startIdx, endIdx + BATON_SECTION_END.length);
    if (existingSection === newSection) {
      return false;
    }
    newContent =
      content.substring(0, startIdx) +
      newSection +
      content.substring(endIdx + BATON_SECTION_END.length);
  } else {
    newContent = content ? `${content.trimEnd()}\n\n${newSection}\n` : `${newSection}\n`;
  }

  await atomicWriteFile(gitignorePath, newContent);
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

  await atomicWriteFile(gitignorePath, newContent ? `${newContent}\n` : "");
  return true;
}

/**
 * Normalized gitignore configuration with explicit booleans for each category.
 *
 * Produced by `parseGitignoreConfig` from the raw baton.yaml `gitignore` field.
 */
export interface GitignoreConfig {
  aiTools: boolean;
  ides: boolean;
  files: boolean;
}

/**
 * Normalize the raw `gitignore` field from baton.yaml into a `GitignoreConfig`.
 *
 * Defaults:
 *   - `undefined` / `true` → { aiTools: true, ides: true, files: false }
 *   - `false`              → { aiTools: false, ides: false, files: false }
 *   - Object               → respects individual fields; missing fields use defaults
 *     (aiTools/ides default to true, files defaults to false)
 */
export function parseGitignoreConfig(
  raw: boolean | { "ai-tools"?: boolean; ides?: boolean; files?: boolean } | undefined,
): GitignoreConfig {
  if (raw === false) {
    return { aiTools: false, ides: false, files: false };
  }
  if (raw === true || raw === undefined) {
    return { aiTools: true, ides: true, files: false };
  }
  // Object form — apply per-category defaults
  return {
    aiTools: raw["ai-tools"] ?? true,
    ides: raw.ides ?? true,
    files: raw.files ?? false,
  };
}

/**
 * Collect gitignore patterns for ALL known AI tool adapters.
 *
 * Generates patterns for the entire adapter registry, ensuring stable,
 * predictable .gitignore content regardless of which tools a developer has installed.
 */
export function collectAiToolPatterns(): string[] {
  const patterns = new Set<string>();

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

  return [...patterns].sort();
}

/**
 * Collect gitignore patterns for ALL known IDE platforms.
 */
export function collectIdePatterns(): string[] {
  const patterns = new Set<string>();

  const allIdePlatforms = getRegisteredIdePlatforms();
  for (const ideKey of allIdePlatforms) {
    const targetDir = getIdePlatformTargetDir(ideKey);
    if (targetDir) {
      const dir = targetDir.endsWith("/") ? targetDir : `${targetDir}/`;
      patterns.add(dir);
    }
  }

  return [...patterns].sort();
}

/**
 * Convert placed file target paths into gitignore patterns.
 *
 * Used when `gitignore.files: true` is set to gitignore custom profile files
 * (e.g. biome.json, tsconfig.json placed by a profile's `files` section).
 */
export function collectFilePatterns(filePaths: string[]): string[] {
  const patterns = new Set<string>();
  for (const filePath of filePaths) {
    addPathPattern(patterns, filePath);
  }
  return [...patterns].sort();
}

/**
 * Collect comprehensive gitignore patterns for ALL known AI tools and IDE platforms.
 *
 * Generates patterns for the entire tool and IDE registry, ensuring stable,
 * predictable .gitignore content regardless of which tools a profile supports
 * or a developer has installed.
 *
 * Note: Project files (from the `files` section in profile manifests) are NOT
 * gitignored — they should be committed so the project works without Baton.
 *
 * Returns deduplicated, sorted patterns for AI tool and IDE configurations.
 *
 * @deprecated Use `collectAiToolPatterns()` and `collectIdePatterns()` separately
 * for granular control. This function remains for backward compatibility.
 */
export function collectComprehensivePatterns(): string[] {
  return [...new Set([...collectAiToolPatterns(), ...collectIdePatterns()])].sort();
}
