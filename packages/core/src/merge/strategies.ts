/**
 * File merge strategies for combining configuration files from multiple profiles.
 * Reference: docs/KONZEPT.md Section 7.2
 */

import { parse, stringify } from "yaml";
import { normalizeMarkdown } from "./content-parts.js";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Merge strategy: replace
 * Target file is completely replaced with source content.
 */
export function mergeReplace(source: string, _target: string): string {
  return source;
}

/**
 * Merge strategy: deep
 * JSON/YAML objects are deep-merged. Source keys override target keys.
 * Uses object spreading for deep merging.
 */
export function mergeDeep(source: string, target: string): string {
  try {
    const sourceObj = parse(source);
    const targetObj = parse(target);

    if (!isPlainObject(sourceObj) || !isPlainObject(targetObj)) {
      // If either is not a plain object, replace
      return source;
    }

    const merged = deepMergeObjects(targetObj, sourceObj);
    return stringify(merged);
  } catch (_error) {
    // If parsing fails, replace
    return source;
  }
}

/**
 * Recursively merge two objects. Source keys override target keys.
 * Arrays are replaced (not merged).
 */
function deepMergeObjects(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
      // Both are plain objects, merge recursively
      result[key] = deepMergeObjects(targetValue, sourceValue);
    } else {
      // Replace with source value (includes arrays)
      result[key] = sourceValue;
    }
  }

  return result;
}

/**
 * Merge strategy: append
 * Source content is appended to target with separator line and profile attribution comment.
 */
export function mergeAppend(source: string, target: string, profileName?: string): string {
  const attribution = profileName ? `# From profile: ${profileName}` : "# From profile";
  const separator = "---";

  return normalizeMarkdown(`${target}\n\n${separator}\n${attribution}\n\n${source}`);
}

/**
 * Merge strategy: prepend
 * Source content is prepended to target with separator line and profile attribution comment.
 */
export function mergePrepend(source: string, target: string, profileName?: string): string {
  const attribution = profileName ? `# From profile: ${profileName}` : "# From profile";
  const separator = "---";

  return normalizeMarkdown(`${attribution}\n\n${source}\n\n${separator}\n\n${target}`);
}

/**
 * Merge strategy: skip
 * Source is only written if target file does not exist.
 * Returns target content if it exists, source content if target is empty/missing.
 */
export function mergeSkip(source: string, target: string): string {
  return target ? target : source;
}

/**
 * Merge strategy: prompt
 * User is interactively asked what to do (replace, skip, diff).
 * This function returns the source by default - interactive prompting happens at a higher level.
 */
export function mergePrompt(source: string, _target: string): string {
  // Interactive prompting is handled by the CLI layer
  // This function just returns source as default behavior
  return source;
}

/**
 * Merge strategy: directory
 * For directory-based configs (like skills):
 * - New files are added
 * - Existing files are overwritten with source content
 * - Non-source existing files are kept
 *
 * This is a marker function - directory merging is handled at the file system level.
 */
export function mergeDirectory(source: string, _target: string): string {
  // Directory merge is handled at the placement engine level
  // Individual files within directories use replace strategy
  return source;
}

/**
 * Merge strategy: import
 * @import-style reference line is added to target file.
 * Used for CLAUDE.md to reference other profile memory files.
 */
export function mergeImport(
  _source: string,
  target: string,
  profileName: string,
  fileName: string,
): string {
  const importLine = `@.baton/profiles/${profileName}/memory/${fileName}`;

  // Check if import already exists
  if (target.includes(importLine)) {
    return target;
  }

  // Add import at the top of the file
  return normalizeMarkdown(target ? `${importLine}\n\n${target}` : importLine);
}
