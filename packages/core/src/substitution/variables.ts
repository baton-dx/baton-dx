import Handlebars from "handlebars";

/**
 * Binary file extensions that should be skipped during substitution
 */
const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".bz2",
  ".7z",
  ".rar",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bin",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".otf",
  ".mp3",
  ".mp4",
  ".avi",
  ".mov",
  ".wmv",
  ".flv",
  ".mkv",
]);

/**
 * Check if a file path points to a binary file based on extension
 */
export function isBinaryFile(filePath: string): boolean {
  const ext = filePath.substring(filePath.lastIndexOf(".")).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

/**
 * Variable sources for substitution (in priority order)
 */
export interface VariableSources {
  manifest?: Record<string, string>;
  cli?: Record<string, string>;
  env?: Record<string, string>;
}

/**
 * Options for variable substitution
 */
export interface SubstitutionOptions {
  /** Variable sources in priority order: manifest > cli > env */
  sources: VariableSources;
  /** Whether to warn about undefined variables (default: true) */
  warnOnUndefined?: boolean;
  /** Callback for warnings */
  onWarning?: (message: string) => void;
}

/**
 * Merge variable sources in priority order: manifest > cli > env
 */
function mergeVariables(sources: VariableSources): Record<string, string> {
  return {
    ...(sources.env ?? {}),
    ...(sources.cli ?? {}),
    ...(sources.manifest ?? {}),
  };
}

/**
 * Substitute variables in content using Handlebars
 *
 * @param content - The content to process
 * @param options - Substitution options
 * @returns Content with variables substituted
 */
export function substituteVariables(content: string, options: SubstitutionOptions): string {
  const variables = mergeVariables(options.sources);

  // Compile Handlebars template
  const template = Handlebars.compile(content, {
    noEscape: true, // Don't HTML-escape values
    strict: false, // Don't throw on undefined variables
  });

  // Track undefined variables for warnings
  const undefinedVars = new Set<string>();

  // Register helper to catch undefined variables and nested paths
  Handlebars.registerHelper("helperMissing", (...args) => {
    // Last argument is the options object from Handlebars
    const handlebarsOptions = args[args.length - 1];
    const varName = handlebarsOptions.name;

    if (options.warnOnUndefined !== false) {
      undefinedVars.add(varName);
    }
    return `{{${varName}}}`;
  });

  // Perform substitution
  const result = template(variables);

  // Emit warnings for undefined variables
  if (options.warnOnUndefined !== false && undefinedVars.size > 0) {
    for (const varName of undefinedVars) {
      const message = `Variable {{${varName}}} is undefined and was left as-is`;
      if (options.onWarning) {
        options.onWarning(message);
      }
    }
  }

  return result;
}

/**
 * Process file content with variable substitution
 *
 * @param content - The file content
 * @param filePath - The file path (used for binary detection)
 * @param options - Substitution options
 * @returns Processed content or original if binary
 */
export function processFileContent(
  content: string,
  filePath: string,
  options: SubstitutionOptions,
): string {
  // Skip binary files
  if (isBinaryFile(filePath)) {
    return content;
  }

  return substituteVariables(content, options);
}
