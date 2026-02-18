import { GitSourceError } from "../errors.js";
import type { ParsedSource } from "../utils/source-parser.js";
import { type ClonedSource, cloneGitSource } from "./git-clone.js";

export interface GitHubResolverOptions {
  source: Extract<ParsedSource, { provider: "github" }>;
  useCache?: boolean;
}

export interface ResolvedGitHubSource {
  localPath: string;
  fromCache: boolean;
  sha: string;
}

/**
 * Resolves a GitHub source by cloning it to the local cache
 *
 * Features:
 * - Supports branch/tag via @ref
 * - Authentication via GitHub Token (GITHUB_TOKEN env var or git credentials)
 * - Caching support (default: enabled)
 * - Error handling for common issues (repo not found, no permission, network errors)
 *
 * @param options - Resolver options including parsed GitHub source
 * @returns Resolved source with local path and metadata
 * @throws GitSourceError for network errors, authentication failures, or invalid repos
 */
export async function resolveGitHubSource(
  options: GitHubResolverOptions,
): Promise<ResolvedGitHubSource> {
  const { source, useCache = true } = options;

  // Enhance URL with GitHub token if available
  const url = getAuthenticatedUrl(source.url);

  try {
    const cloned: ClonedSource = await cloneGitSource({
      url,
      ref: source.ref,
      subpath: source.subpath,
      useCache,
    });

    return {
      localPath: cloned.localPath,
      fromCache: cloned.fromCache,
      sha: cloned.sha,
    };
  } catch (error) {
    // Enhanced error messages for common GitHub issues
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes("Authentication failed")) {
      throw new GitSourceError(
        `GitHub authentication failed for ${source.org}/${source.repo}. Set GITHUB_TOKEN environment variable for private repos.`,
        { cause: error },
      );
    }

    if (errorMessage.includes("Repository not found") || errorMessage.includes("404")) {
      throw new GitSourceError(
        `GitHub repository not found: ${source.org}/${source.repo}. Check that the repository exists and you have access.`,
        { cause: error },
      );
    }

    if (errorMessage.includes("Permission denied") || errorMessage.includes("403")) {
      throw new GitSourceError(
        `Permission denied for GitHub repository: ${source.org}/${source.repo}. Verify your access rights or provide a valid GITHUB_TOKEN.`,
        { cause: error },
      );
    }

    if (
      errorMessage.includes("network") ||
      errorMessage.includes("timeout") ||
      errorMessage.includes("ENOTFOUND")
    ) {
      throw new GitSourceError(
        `Network error while cloning ${source.org}/${source.repo}: ${errorMessage}. Check your internet connection.`,
        { cause: error },
      );
    }

    // Re-throw original error if no specific case matched
    throw error;
  }
}

/**
 * Enhances the GitHub URL with authentication token if available
 * Supports GITHUB_TOKEN environment variable for private repos
 */
function getAuthenticatedUrl(url: string): string {
  const token = process.env.GITHUB_TOKEN;

  // Check for undefined or empty string
  if (!token || token === "undefined") {
    // No token - rely on git credentials or public access
    return url;
  }

  // Convert https://github.com/org/repo.git to https://token@github.com/org/repo.git
  if (url.startsWith("https://github.com/")) {
    return url.replace("https://github.com/", `https://${token}@github.com/`);
  }

  // For other HTTPS URLs (GHE), insert token as well
  if (url.startsWith("https://")) {
    return url.replace("https://", `https://${token}@`);
  }

  // For git@ URLs, leave unchanged (git credentials will be used)
  return url;
}
