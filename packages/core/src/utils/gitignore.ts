import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getAdaptersForKeys } from "../adapters/registry.js";
import type { ToolAdapter } from "../adapters/types.js";
import { getIdePlatformTargetDir } from "../ide/platform-registry.js";

/**
 * Parameters for collecting synced gitignore patterns.
 */
export interface CollectSyncedPatternsOptions {
  /** Adapters that are being synced to */
  adapters: ToolAdapter[];
  /** Command names that were placed (from profile manifests) */
  commandNames: string[];
  /** File targets that were placed (from profile manifests, e.g. "biome.json") */
  fileTargets: string[];
  /** IDE directory targets that were placed (e.g. ".vscode/", ".idea/") */
  ideTargets: string[];
  /** Skill names that were placed */
  skillNames: string[];
  /** Rule names that were placed */
  ruleNames: string[];
  /** Memory filenames that were placed */
  memoryNames: string[];
}

/**
 * Collect gitignore patterns for all files placed by baton sync.
 *
 * Returns deduplicated, sorted patterns that should be in .gitignore
 * to prevent baton-managed files from being committed.
 */
export function collectSyncedPatterns(options: CollectSyncedPatternsOptions): string[] {
  const patterns = new Set<string>();

  const { adapters, commandNames, fileTargets, ideTargets, skillNames, ruleNames, memoryNames } =
    options;

  // Commands patterns: adapter-specific command directories
  if (commandNames.length > 0) {
    for (const adapter of adapters) {
      // Get the path for a sample command to determine the directory structure
      const samplePath = adapter.getPath("commands", "project", commandNames[0]);
      // Extract directory from the sample path (e.g. ".claude/commands/review.md" -> ".claude/commands/")
      const lastSlash = samplePath.lastIndexOf("/");
      if (lastSlash > 0) {
        const dir = samplePath.substring(0, lastSlash + 1);
        patterns.add(dir);
      }
    }
  }

  // Skills patterns: adapter-specific skill directories
  if (skillNames.length > 0) {
    for (const adapter of adapters) {
      const samplePath = adapter.getPath("skills", "project", skillNames[0]);
      const lastSlash = samplePath.lastIndexOf("/");
      if (lastSlash > 0) {
        // Skills are directories — extract parent dir (e.g. ".claude/skills/foo" -> ".claude/skills/")
        const parentPath = samplePath.substring(0, lastSlash + 1);
        patterns.add(parentPath);
      }
    }
  }

  // Rules patterns: adapter-specific rule directories or files
  if (ruleNames.length > 0) {
    for (const adapter of adapters) {
      const samplePath = adapter.getPath("rules", "project", ruleNames[0]);
      const lastSlash = samplePath.lastIndexOf("/");
      if (lastSlash > 0) {
        const dir = samplePath.substring(0, lastSlash + 1);
        patterns.add(dir);
      } else {
        // Single file at project root (e.g. copilot-instructions.md)
        patterns.add(samplePath);
      }
    }
  }

  // Memory patterns: adapter-specific memory files/directories
  if (memoryNames.length > 0) {
    for (const adapter of adapters) {
      const samplePath = adapter.getPath("memory", "project", memoryNames[0]);
      const lastSlash = samplePath.lastIndexOf("/");
      if (lastSlash > 0) {
        const dir = samplePath.substring(0, lastSlash + 1);
        patterns.add(dir);
      } else {
        patterns.add(samplePath);
      }
    }
  }

  // Files patterns: individual file targets at project root
  for (const target of fileTargets) {
    patterns.add(target);
  }

  // IDE patterns: top-level IDE directories
  for (const target of ideTargets) {
    // Ensure trailing slash for directories
    const dir = target.endsWith("/") ? target : `${target}/`;
    patterns.add(dir);
  }

  return [...patterns].sort();
}

/**
 * Parameters for collecting gitignore patterns from profile support declaration.
 */
export interface CollectProfileSupportPatternsOptions {
  /** AI tool keys declared by ALL profiles in this project (union across profiles) */
  profileAiTools: string[];
  /** IDE platform keys declared by ALL profiles in this project (union across profiles) */
  profileIdePlatforms: string[];
  /** File targets placed by sync (from profile manifests, e.g. "biome.json") */
  fileTargets: string[];
  /** Whether the profile has any content that gets synced (skills, rules, memory, commands) */
  hasContent: boolean;
}

/**
 * Collect gitignore patterns from the profile's declared tool support.
 *
 * Unlike collectSyncedPatterns (which uses the developer's intersection),
 * this function generates patterns for ALL tools the profile supports.
 * This ensures consistent .gitignore across all team members regardless
 * of which tools each developer has installed.
 *
 * Returns deduplicated, sorted patterns including baton.lock.
 */
export function collectProfileSupportPatterns(
  options: CollectProfileSupportPatternsOptions,
): string[] {
  const patterns = new Set<string>();
  const { profileAiTools, profileIdePlatforms, fileTargets, hasContent } = options;

  // AI tool patterns: directories, memory files, and legacy paths for ALL profile-supported tools
  if (profileAiTools.length > 0 && hasContent) {
    const adapters = getAdaptersForKeys(profileAiTools);

    for (const adapter of adapters) {
      // Probe each config type with a dummy name to discover directory structure
      // Commands directory
      const commandPath = adapter.getPath("commands", "project", "_probe");
      addDirPattern(patterns, commandPath);

      // Skills directory
      const skillPath = adapter.getPath("skills", "project", "_probe");
      addDirPattern(patterns, skillPath);

      // Rules directory or file
      const rulePath = adapter.getPath("rules", "project", "_probe");
      addPathPattern(patterns, rulePath);

      // Memory file or directory
      const memoryPath = adapter.getPath("memory", "project", "_probe");
      addPathPattern(patterns, memoryPath);

      // Agents directory
      const agentPath = adapter.getPath("agents", "project", "_probe");
      addDirPattern(patterns, agentPath);

      // Legacy paths (e.g. .cursorrules, .windsurfrules)
      for (const legacyPath of adapter.getLegacyPaths("rules")) {
        patterns.add(legacyPath);
      }
    }
  }

  // IDE patterns: directories for ALL profile-supported IDE platforms
  for (const ideKey of profileIdePlatforms) {
    const targetDir = getIdePlatformTargetDir(ideKey);
    if (targetDir) {
      const dir = targetDir.endsWith("/") ? targetDir : `${targetDir}/`;
      patterns.add(dir);
    }
  }

  // Files patterns: individual file targets at project root
  for (const target of fileTargets) {
    patterns.add(target);
  }

  // Always include baton.lock (developer-specific, should not be committed)
  patterns.add("baton.lock");

  return [...patterns].sort();
}

/**
 * Extract directory from a path and add it as a pattern.
 * E.g. ".claude/commands/_probe.md" -> ".claude/commands/"
 */
function addDirPattern(patterns: Set<string>, path: string): void {
  const lastSlash = path.lastIndexOf("/");
  if (lastSlash > 0) {
    patterns.add(path.substring(0, lastSlash + 1));
  }
}

/**
 * Add a path pattern — directory if it contains slashes, root file otherwise.
 * E.g. ".claude/rules/_probe.md" -> ".claude/rules/"
 * E.g. "CLAUDE.md" -> "CLAUDE.md"
 */
function addPathPattern(patterns: Set<string>, path: string): void {
  const lastSlash = path.lastIndexOf("/");
  if (lastSlash > 0) {
    patterns.add(path.substring(0, lastSlash + 1));
  } else if (path) {
    patterns.add(path);
  }
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
