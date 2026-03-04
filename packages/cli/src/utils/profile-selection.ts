import { resolve } from "node:path";
import {
    type ClonedSource,
    cloneGitSource,
    discoverProfilesInSourceRepo,
    getAuthenticatedUrl,
    getAuthSetupInstructions,
    parseSource,
    resolveAuth,
} from "@baton-dx/core";
import * as p from "@clack/prompts";
import { cascadingMultiselect } from "./cascading-multiselect.js";
import { buildHierarchicalSelectOptions, buildProfileTree } from "./profile-tree.js";

/**
 * Discovers and prompts user to select multiple profiles from a source.
 * Returns array of full source strings with profile paths.
 *
 * Used by `baton init` to allow installing multiple profiles at once.
 *
 * @param sourceString - Source string to discover profiles from (e.g., "github:org/repo")
 * @returns Array of source strings with selected profile paths (e.g., ["github:org/repo/frontend", "github:org/repo/backend"])
 */
export async function selectMultipleProfilesFromSource(
    sourceString: string,
    options?: {
        nonInteractive?: boolean;
        installedSources?: string[];
    },
): Promise<string[]> {
    const parsedSource = parseSource(sourceString);

    // Only GitHub/GitLab sources without subpath require interactive selection
    if (
        (parsedSource.provider === "github" || parsedSource.provider === "gitlab") &&
        !parsedSource.subpath
    ) {
        const spinner = p.spinner();
        spinner.start("Cloning repository to discover profiles...");

        try {
            // Pre-resolve auth via cascade
            const hostname = new URL(parsedSource.url).hostname;
            const auth = await resolveAuth(hostname);
            if (auth.method === "none") {
                spinner.stop("Authentication failed");
                p.cancel(`❌ ${getAuthSetupInstructions(hostname, auth.triedMethods)}`);
                process.exit(1);
            }
            const cloneUrl = await getAuthenticatedUrl(parsedSource.url, auth);

            const cloned: ClonedSource = await cloneGitSource({
                url: cloneUrl,
                ref: parsedSource.ref,
                useCache: true,
                maxCacheAgeMs: 0,
                authToken: auth.token,
            });

            spinner.stop("✅ Repository cloned");

            const profiles = await discoverProfilesInSourceRepo(cloned.localPath);

            if (profiles.length === 0) {
                p.cancel("❌ No profiles found in the source repository");
                process.exit(1);
            }

            // Single profile - auto-select
            if (profiles.length === 1) {
                p.note(`Using profile: ${profiles[0].name}`, "Profile");
                const fullPath = constructProfilePath(parsedSource, profiles[0].path);
                return [fullPath];
            }

            // Non-interactive: auto-select all profiles
            if (options?.nonInteractive) {
                p.note(`Auto-selecting all ${profiles.length} profile(s)`, "Non-interactive mode");
                return profiles.map((prof) => constructProfilePath(parsedSource, prof.path));
            }

            // Multiple profiles - show hierarchical multi-select with cascading
            const roots = buildProfileTree(profiles);
            const selectOptions = buildHierarchicalSelectOptions(roots);

            // Compute initial values from installed sources
            const initialValues: string[] = [];
            if (options?.installedSources) {
                for (const profile of profiles) {
                    const fullPath = constructProfilePath(parsedSource, profile.path);
                    if (options.installedSources.includes(fullPath)) {
                        initialValues.push(profile.path);
                    }
                }
            }

            const selected = await cascadingMultiselect({
                message: options?.installedSources
                    ? "Manage profiles: (Space to toggle, Enter to confirm)"
                    : "Select profile(s) to install: (Space to select, Enter to continue)",
                options: selectOptions,
                profiles,
                required: !options?.installedSources,
                initialValues: initialValues.length > 0 ? initialValues : undefined,
            });

            if (p.isCancel(selected)) {
                p.cancel("❌ Profile selection cancelled");
                process.exit(0);
            }

            // Map selected paths to full source strings
            return selected.map((path) => constructProfilePath(parsedSource, path));
        } catch (error) {
            spinner.stop("❌ Failed to clone repository");
            p.cancel(
                `❌ Failed to discover profiles: ${error instanceof Error ? error.message : String(error)}`,
            );
            process.exit(1);
        }
    }

    // Local/file sources: discover profiles from local directory
    if (parsedSource.provider === "file" || parsedSource.provider === "local") {
        const absolutePath = parsedSource.path.startsWith("/")
            ? parsedSource.path
            : resolve(process.cwd(), parsedSource.path);

        const profiles = await discoverProfilesInSourceRepo(absolutePath);

        if (profiles.length === 0) {
            // Possibly pointing directly at a single profile
            return [sourceString];
        }

        if (profiles.length === 1) {
            p.note(`Using profile: ${profiles[0].name}`, "Profile");
            const profilePath =
                profiles[0].path === "." ? sourceString : `${sourceString}/${profiles[0].path}`;
            return [profilePath];
        }

        // Non-interactive: auto-select all profiles
        if (options?.nonInteractive) {
            p.note(`Auto-selecting all ${profiles.length} profile(s)`, "Non-interactive mode");
            return profiles.map((prof) =>
                prof.path === "." ? sourceString : `${sourceString}/${prof.path}`,
            );
        }

        // Multiple profiles - show hierarchical multi-select with cascading
        const roots = buildProfileTree(profiles);
        const selectOptions = buildHierarchicalSelectOptions(roots);

        // Compute initial values from installed sources
        const initialValues: string[] = [];
        if (options?.installedSources) {
            for (const profile of profiles) {
                const fullPath =
                    profile.path === "." ? sourceString : `${sourceString}/${profile.path}`;
                if (options.installedSources.includes(fullPath)) {
                    initialValues.push(profile.path);
                }
            }
        }

        const selected = await cascadingMultiselect({
            message: options?.installedSources
                ? "Manage profiles: (Space to toggle, Enter to confirm)"
                : "Select profile(s) to install: (Space to select, Enter to continue)",
            options: selectOptions,
            profiles,
            required: !options?.installedSources,
            initialValues: initialValues.length > 0 ? initialValues : undefined,
        });

        if (p.isCancel(selected)) {
            p.cancel("❌ Profile selection cancelled");
            process.exit(0);
        }

        return selected.map((path) => (path === "." ? sourceString : `${sourceString}/${path}`));
    }

    // Direct path provided - return as-is (single profile)
    return [sourceString];
}

/**
 * Helper: Constructs full source path with profile subpath.
 *
 * @param parsed - Parsed source object (github or gitlab only)
 * @param profilePath - Profile path (e.g., ".", "frontend", "backend")
 * @returns Full source string (e.g., "github:org/repo/frontend")
 */
function constructProfilePath(
    parsed: Extract<ReturnType<typeof parseSource>, { provider: "github" | "gitlab" }>,
    profilePath: string,
): string {
    // Root profile
    if (profilePath === ".") {
        const baseSource = parsed.ref
            ? `${parsed.provider}:${parsed.org}/${parsed.repo}@${parsed.ref}`
            : `${parsed.provider}:${parsed.org}/${parsed.repo}`;
        return baseSource;
    }

    // Sub-profile: github:org/repo[@ref]/profilePath
    const baseSource = parsed.ref
        ? `${parsed.provider}:${parsed.org}/${parsed.repo}@${parsed.ref}`
        : `${parsed.provider}:${parsed.org}/${parsed.repo}`;

    return `${baseSource}/${profilePath}`;
}
