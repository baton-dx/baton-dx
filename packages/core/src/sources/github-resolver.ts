import { GitSourceError } from "../errors.js";
import type { ParsedSource } from "../utils/source-parser.js";
import { type AuthResult, resolveAuth } from "./auth-cascade.js";
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
 * - Authentication via auth cascade (env vars, SSH, gh CLI, git credential helper)
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

    // Resolve auth via cascade and build the appropriate URL
    const hostname = extractHostname(source.url);
    const auth = await resolveAuth(hostname);
    const url = await getAuthenticatedUrl(source.url, auth);

    try {
        const cloned: ClonedSource = await cloneGitSource({
            url,
            ref: source.ref,
            subpath: source.subpath,
            useCache,
            authToken: auth.token,
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
                `GitHub authentication failed for ${source.org}/${source.repo}. Run \`gh auth login\` or set GITHUB_TOKEN for private repos.`,
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
                `Permission denied for GitHub repository: ${source.org}/${source.repo}. Verify your access rights or run \`gh auth login\`.`,
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
 * Builds a clone URL using the resolved auth result.
 * Converts to SSH URL when useSSH is true. Tokens are never embedded in the URL —
 * they are injected via git env vars in cloneGitSource/resolveVersion instead.
 */
export async function getAuthenticatedUrl(url: string, auth: AuthResult): Promise<string> {
    // SSH: convert HTTPS to git@ URL
    if (auth.useSSH && url.startsWith("https://")) {
        const parsed = new URL(url);
        const path = parsed.pathname.replace(/^\//, "");
        return `git@${parsed.hostname}:${path}`;
    }

    // Return URL as-is — token auth is handled via git HTTP header env vars
    return url;
}

function extractHostname(url: string): string {
    try {
        if (url.startsWith("https://") || url.startsWith("http://")) {
            return new URL(url).hostname;
        }
        // git@github.com:org/repo.git
        const atIdx = url.indexOf("@");
        const colonIdx = atIdx !== -1 ? url.indexOf(":", atIdx + 1) : -1;
        if (atIdx !== -1 && colonIdx !== -1) {
            return url.slice(atIdx + 1, colonIdx);
        }
        return "github.com";
    } catch {
        return "github.com";
    }
}
