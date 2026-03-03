import { maxSatisfying, valid } from "semver";
import type { SimpleGit } from "simple-git";
import { GitAuthenticationError, VersionNotFoundError } from "../errors.js";
import { createGit, isAuthError, redactUrl, withTokenAuth } from "./git-utils.js";

/**
 * Resolves a version specification to a specific Git ref (commit SHA, tag, or branch).
 *
 * Callers should pass a pre-authenticated URL (with token embedded or SSH format)
 * via the auth cascade. This function always uses non-interactive git.
 *
 * Supported version specs:
 * - Semver range: "^1.0.0", "~2.3.0", ">=1.0.0 <2.0.0"
 * - Exact tag: "v2.0.0", "2.0.0"
 * - Branch name: "main", "develop"
 * - Commit SHA: "abc1234567890def"
 * - "latest": resolves to newest semver tag, or HEAD if no tags
 *
 * @param repoUrl - The Git repository URL (clean, without embedded credentials)
 * @param versionSpec - The version specification to resolve (default: "latest")
 * @param authToken - Optional auth token injected via git HTTP header env vars
 * @returns The resolved Git ref (commit SHA)
 */
export async function resolveVersion(
    repoUrl: string,
    versionSpec = "latest",
    authToken?: string,
): Promise<string> {
    const git: SimpleGit = authToken ? withTokenAuth(createGit(), repoUrl, authToken) : createGit();
    const safeUrl = redactUrl(repoUrl);

    try {
        // Fetch all refs from remote without cloning
        const remoteRefs = await git.listRemote(["--tags", "--heads", "--refs", repoUrl]);

        // Parse remote refs into tags and branches
        const tags: string[] = [];
        const branches: Map<string, string> = new Map();

        for (const line of remoteRefs.split("\n")) {
            const match = line.match(/^([a-f0-9]+)\s+refs\/(tags|heads)\/(.+)$/);
            if (match) {
                const [, sha, type, name] = match;
                if (type === "tags") {
                    tags.push(name);
                } else if (type === "heads") {
                    branches.set(name, sha);
                }
            }
        }

        // Handle "latest" - resolve to newest semver tag, or HEAD if no tags
        if (versionSpec === "latest") {
            const semverTags = tags.map((tag) => tag.replace(/^v/, "")).filter((tag) => valid(tag));

            if (semverTags.length > 0) {
                const latest = maxSatisfying(semverTags, "*");
                if (latest) {
                    // Find the SHA for this tag
                    const tagName = tags.find((t) => t === latest || t === `v${latest}`);
                    if (tagName) {
                        const tagSha = await getTagSha(git, repoUrl, tagName);
                        return tagSha;
                    }
                }
            }

            // No semver tags found, return HEAD of default branch
            const defaultBranch = branches.get("main") || branches.get("master");
            if (defaultBranch) {
                return defaultBranch;
            }

            throw new VersionNotFoundError(`No versions found in repository: ${safeUrl}`);
        }

        // Check if it's a commit SHA (40 hex chars) - do this before other checks
        if (/^[a-f0-9]{40}$/.test(versionSpec)) {
            return versionSpec;
        }

        // Check if it's a short commit SHA (7-40 hex chars) - we can't verify this without cloning
        if (/^[a-f0-9]{7,39}$/.test(versionSpec)) {
            return versionSpec; // Assume it's valid, Git will error if not
        }

        // Check if it's a branch name
        if (branches.has(versionSpec)) {
            return branches.get(versionSpec) as string;
        }

        // Check if it's an exact tag
        if (tags.includes(versionSpec) || tags.includes(`v${versionSpec}`)) {
            const tagName = tags.includes(versionSpec) ? versionSpec : `v${versionSpec}`;
            return await getTagSha(git, repoUrl, tagName);
        }

        // Try to interpret as semver range
        const semverTags = tags.map((tag) => tag.replace(/^v/, "")).filter((tag) => valid(tag));

        if (semverTags.length === 0) {
            throw new VersionNotFoundError(
                `No semver tags found in repository: ${safeUrl}. Available branches: ${Array.from(branches.keys()).join(", ")}`,
            );
        }

        // Find the best matching version
        const matchedVersion = maxSatisfying(semverTags, versionSpec);

        if (!matchedVersion) {
            throw new VersionNotFoundError(
                `No version matching "${versionSpec}" found. Available versions: ${semverTags.join(", ")}`,
            );
        }

        // Find the tag name (with or without v prefix)
        const tagName = tags.find((t) => t === matchedVersion || t === `v${matchedVersion}`);
        if (!tagName) {
            throw new VersionNotFoundError(`Tag for version ${matchedVersion} not found`);
        }

        return await getTagSha(git, repoUrl, tagName);
    } catch (error) {
        if (error instanceof VersionNotFoundError) {
            throw error;
        }
        if (isAuthError(error)) {
            throw new GitAuthenticationError(`Authentication required for ${safeUrl}`, error);
        }
        throw new VersionNotFoundError(
            `Failed to resolve version "${versionSpec}" for ${safeUrl}: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

/**
 * Gets the commit SHA that a tag points to.
 */
async function getTagSha(git: SimpleGit, repoUrl: string, tagName: string): Promise<string> {
    const result = await git.listRemote(["--tags", repoUrl, `refs/tags/${tagName}`]);
    const match = result.match(/^([a-f0-9]+)/);
    if (match) {
        return match[1];
    }
    throw new VersionNotFoundError(`Could not resolve tag ${tagName} to SHA`);
}
