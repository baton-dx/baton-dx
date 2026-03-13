import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { SourceParseError } from "../errors.js";

/**
 * Parsed source object representing where to fetch a profile from
 */
export type ParsedSource =
    | {
          provider: "github";
          org: string;
          repo: string;
          subpath?: string;
          ref?: string;
          url: string;
      }
    | {
          provider: "gitlab";
          org: string;
          repo: string;
          subpath?: string;
          ref?: string;
          url: string;
      }
    | {
          provider: "local";
          path: string;
      }
    | {
          provider: "git";
          url: string;
          ref?: string;
      }
    | {
          provider: "file";
          path: string;
      }
    | {
          provider: "npm";
          package: string;
          scope?: string;
          subpath?: string;
      };

/**
 * Parse various source URL formats into a normalized source object
 *
 * Supports:
 * - github:org/repo
 * - github:org/repo/subpath
 * - github:org/repo@v2.0
 * - github:org/repo@main
 * - gitlab:org/repo
 * - file:path/to/profile (relative or absolute)
 * - npm:package or npm:@scope/package
 * - npm:package/subpath
 * - ./local/path
 * - https://git.example.com/repo.git
 *
 * @param source - Source string to parse
 * @returns Parsed source object with provider, org, repo, url, etc.
 * @throws SourceParseError if the source format is invalid
 */
export function parseSource(source: string): ParsedSource {
    // Trim whitespace
    const trimmed = source.trim();

    if (!trimmed) {
        throw new SourceParseError("Source string cannot be empty");
    }

    // Local path (starts with ./ or ../ or / or ~/)
    if (
        trimmed.startsWith("./") ||
        trimmed.startsWith("../") ||
        trimmed.startsWith("/") ||
        trimmed.startsWith("~/")
    ) {
        return {
            provider: "local",
            path: trimmed,
        };
    }

    // GitHub shorthand: github:org/repo[@ref][/subpath]
    if (trimmed.startsWith("github:")) {
        const withoutPrefix = trimmed.slice(7); // Remove "github:"
        return parseGitProvider("github", withoutPrefix);
    }

    // GitLab shorthand: gitlab:org/repo[@ref][/subpath]
    if (trimmed.startsWith("gitlab:")) {
        const withoutPrefix = trimmed.slice(7); // Remove "gitlab:"
        return parseGitProvider("gitlab", withoutPrefix);
    }

    // File path: file:path/to/profile
    if (trimmed.startsWith("file:")) {
        const path = trimmed.slice(5); // Remove "file:"
        if (!path) {
            throw new SourceParseError("Invalid file source: missing path");
        }
        return {
            provider: "file",
            path,
        };
    }

    // NPM package: npm:[@scope/]package[/subpath]
    if (trimmed.startsWith("npm:")) {
        const withoutPrefix = trimmed.slice(4); // Remove "npm:"
        return parseNpmPackage(withoutPrefix);
    }

    // Full Git URL: https://... or git@...
    if (trimmed.startsWith("https://") || trimmed.startsWith("git@")) {
        return {
            provider: "git",
            url: trimmed,
        };
    }

    throw new SourceParseError(
        `Invalid source format: "${source}". Expected formats: github:org/repo, gitlab:org/repo, file:path, npm:package, ./local/path, or https://git.example.com/repo.git`,
    );
}

/**
 * Parse GitHub or GitLab shorthand format
 * Format: org/repo[@ref][/subpath]
 */
function parseGitProvider(
    provider: "github" | "gitlab",
    input: string,
): Extract<ParsedSource, { provider: "github" | "gitlab" }> {
    // Split by @ to extract ref if present
    const [pathPart, ref] = input.split("@");

    if (!pathPart) {
        throw new SourceParseError(`Invalid ${provider} source: missing org/repo`);
    }

    // Split path by / to extract org, repo, and optional subpath
    const parts = pathPart.split("/");

    if (parts.length < 2) {
        throw new SourceParseError(`Invalid ${provider} source: expected format org/repo`);
    }

    const [org, repo, ...subpathParts] = parts;

    if (!org || !repo) {
        throw new SourceParseError(`Invalid ${provider} source: org and repo cannot be empty`);
    }

    const baseUrl = provider === "github" ? "https://github.com" : "https://gitlab.com";
    const url = `${baseUrl}/${org}/${repo}.git`;

    const result: Extract<ParsedSource, { provider: "github" | "gitlab" }> = {
        provider,
        org,
        repo,
        url,
    };

    if (subpathParts.length > 0) {
        result.subpath = subpathParts.join("/");
    }

    if (ref) {
        result.ref = ref;
    }

    return result;
}

/**
 * Parse NPM package format
 * Format: [@scope/]package[/subpath]
 */
function parseNpmPackage(input: string): Extract<ParsedSource, { provider: "npm" }> {
    if (!input) {
        throw new SourceParseError("Invalid npm source: missing package name");
    }

    // Handle scoped packages: @scope/package[/subpath]
    if (input.startsWith("@")) {
        const parts = input.split("/");

        if (parts.length < 2) {
            throw new SourceParseError(
                "Invalid npm source: scoped package must have format @scope/package",
            );
        }

        const scope = parts[0]; // @scope
        const packageName = parts[1];
        const subpathParts = parts.slice(2);

        if (!scope || !packageName) {
            throw new SourceParseError(
                "Invalid npm source: scope and package name cannot be empty",
            );
        }

        const result: Extract<ParsedSource, { provider: "npm" }> = {
            provider: "npm",
            package: `${scope}/${packageName}`,
            scope: scope.slice(1), // Remove @ prefix for scope field
        };

        if (subpathParts.length > 0) {
            result.subpath = subpathParts.join("/");
        }

        return result;
    }

    // Handle non-scoped packages: package[/subpath]
    const parts = input.split("/");
    const packageName = parts[0];
    const subpathParts = parts.slice(1);

    if (!packageName) {
        throw new SourceParseError("Invalid npm source: package name cannot be empty");
    }

    const result: Extract<ParsedSource, { provider: "npm" }> = {
        provider: "npm",
        package: packageName,
    };

    if (subpathParts.length > 0) {
        result.subpath = subpathParts.join("/");
    }

    return result;
}

/**
 * Resolve a local source path to an absolute filesystem path.
 *
 * - `~/...`  → expanded relative to the user's home directory (stored as-is in baton.yaml for portability)
 * - `/...`   → already absolute, returned as-is
 * - `./...`  → resolved relative to baseDir
 * - `../...` → resolved relative to baseDir
 */
export function expandLocalPath(path: string, baseDir: string): string {
    if (path.startsWith("~/")) {
        return join(homedir(), path.slice(2));
    }
    if (path.startsWith("/")) {
        return path;
    }
    return resolve(baseDir, path);
}
