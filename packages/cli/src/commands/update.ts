import { resolve } from "node:path";
import {
  type LockFile,
  type ParsedSource,
  SourceParseError,
  cloneGitSource,
  generateLock,
  loadLockfile,
  loadProjectManifest,
  parseSource,
  resolveVersion,
  writeLock,
} from "@baton-dx/core";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";

interface UpdateCandidate {
  name: string;
  source: string;
  currentVersion: string;
  latestVersion: string;
  changes: string[];
}

export const updateCommand = defineCommand({
  meta: {
    name: "update",
    description: "Check for and apply updates to installed profiles and packages",
  },
  args: {
    "dry-run": {
      type: "boolean",
      description: "Show available updates without applying them",
      default: false,
    },
    yes: {
      type: "boolean",
      description: "Apply all updates without confirmation prompts",
      default: false,
    },
  },
  async run({ args }) {
    const dryRun = args["dry-run"];
    const autoConfirm = args.yes;

    p.intro("Baton Update");

    const cwd = process.cwd();
    const manifestPath = resolve(cwd, "baton.yaml");
    const lockfilePath = resolve(cwd, "baton.lock");

    // Load project manifest
    const spinner = p.spinner();
    spinner.start("Loading project configuration");

    let manifest: Awaited<ReturnType<typeof loadProjectManifest>>;
    try {
      manifest = await loadProjectManifest(manifestPath);
    } catch (error) {
      spinner.stop("Failed to load baton.yaml");
      p.cancel(error instanceof Error ? error.message : "Could not load project manifest");
      process.exit(1);
    }

    // Load lockfile if it exists
    let lockfile: LockFile | null = null;
    try {
      lockfile = await loadLockfile(lockfilePath);
      spinner.stop("Configuration loaded");
    } catch {
      spinner.stop("Configuration loaded (no lockfile found)");
      p.note("No lockfile found. Run 'baton sync' first to create one.");
    }

    // Find update candidates
    spinner.start("Checking for updates");
    const updateCandidates: UpdateCandidate[] = [];

    for (const profile of manifest.profiles || []) {
      try {
        const parsed = parseSource(profile.source);

        // Skip local/file sources (no remote updates available)
        if (parsed.provider === "local" || parsed.provider === "file") {
          continue;
        }

        // Get current version from lockfile
        const packageName = getPackageName(parsed);
        const currentVersion =
          lockfile?.packages[packageName]?.version || profile.version || "HEAD";

        // Resolve latest version from remote
        const latestVersion = await getLatestVersion(parsed);

        // Compare versions
        if (currentVersion !== latestVersion) {
          const changes = await getChangeSummary(parsed, currentVersion, latestVersion);

          updateCandidates.push({
            name: packageName,
            source: profile.source,
            currentVersion,
            latestVersion,
            changes,
          });
        }
      } catch (error) {
        if (error instanceof SourceParseError) {
          p.log.warn(`Skipping invalid source: ${profile.source}`);
        }
      }
    }

    spinner.stop("Update check complete");

    // Display results
    if (updateCandidates.length === 0) {
      p.outro("All packages are up to date!");
      process.exit(0);
    }

    // Show available updates
    p.note(`Found ${updateCandidates.length} update${updateCandidates.length > 1 ? "s" : ""}`);

    for (const candidate of updateCandidates) {
      console.log(
        `\n📦 ${candidate.name}: ${candidate.currentVersion} → ${candidate.latestVersion}`,
      );

      if (candidate.changes.length > 0) {
        console.log("   Changes:");
        for (const change of candidate.changes) {
          console.log(`   - ${change}`);
        }
      }
    }

    // Exit if dry-run
    if (dryRun) {
      p.outro(
        "Dry-run mode enabled. No changes were made.\nRun 'baton update' without --dry-run to apply updates.",
      );
      process.exit(0);
    }

    // Confirm before applying
    if (!autoConfirm) {
      const confirmed = await p.confirm({
        message: `Apply ${updateCandidates.length} update${updateCandidates.length > 1 ? "s" : ""}?`,
        initialValue: true,
      });

      if (p.isCancel(confirmed) || !confirmed) {
        p.cancel("Update cancelled");
        process.exit(0);
      }
    }

    // Apply updates
    spinner.start("Applying updates");

    const updatedPackages: Record<
      string,
      {
        source: string;
        resolved: string;
        version: string;
        sha: string;
        files: Record<string, string>; // filename -> content
      }
    > = {};

    for (const candidate of updateCandidates) {
      try {
        const parsed = parseSource(candidate.source);

        // Clone with latest version
        const url =
          parsed.provider === "github" || parsed.provider === "gitlab"
            ? parsed.url
            : parsed.provider === "git"
              ? parsed.url
              : "";

        if (!url) {
          spinner.stop("Update failed");
          p.cancel(`Cannot update local source: ${candidate.name}`);
          process.exit(1);
        }

        const clonedSource = await cloneGitSource({
          url,
          ref: candidate.latestVersion,
          subpath: parsed.provider !== "local" && "subpath" in parsed ? parsed.subpath : undefined,
        });

        // Integrity hashes are left empty — they refer to placed files, not source files.
        // Running `baton sync` after update will regenerate correct integrity hashes.
        const files: Record<string, string> = {};

        updatedPackages[candidate.name] = {
          source: candidate.source,
          resolved: url,
          version: candidate.latestVersion,
          sha: clonedSource.sha,
          files,
        };
      } catch (error) {
        spinner.stop("Update failed");
        p.cancel(
          `Failed to update ${candidate.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        process.exit(1);
      }
    }

    // Update lockfile - generateLock expects files (content), converts to integrity (hashes)
    const newLock = generateLock(updatedPackages);

    if (lockfile) {
      // Merge updated packages with existing lockfile
      lockfile.packages = { ...lockfile.packages, ...newLock.packages };
      lockfile.locked_at = new Date().toISOString();

      await writeLock(lockfile, lockfilePath);
    } else {
      // Create new lockfile
      await writeLock(newLock, lockfilePath);
    }

    spinner.stop("Updates applied successfully");

    p.outro(
      `✅ Updated ${updateCandidates.length} package${updateCandidates.length > 1 ? "s" : ""}!\n\nRun 'baton sync' to apply the updated configurations.`,
    );
    process.exit(0);
  },
});

function getPackageName(parsed: ParsedSource): string {
  if (parsed.provider === "local" || parsed.provider === "file") {
    return parsed.path;
  }
  if (parsed.provider === "github" || parsed.provider === "gitlab") {
    return `${parsed.org}/${parsed.repo}`;
  }
  if (parsed.provider === "npm") {
    return parsed.scope ? `${parsed.scope}/${parsed.package}` : parsed.package;
  }
  if (parsed.provider === "git") {
    return parsed.url;
  }
  return "unknown";
}

async function getLatestVersion(parsed: ParsedSource): Promise<string> {
  if (parsed.provider === "local") {
    return "local";
  }

  const url =
    parsed.provider === "github" || parsed.provider === "gitlab"
      ? parsed.url
      : parsed.provider === "git"
        ? parsed.url
        : "";

  if (!url) {
    return "HEAD";
  }

  return await resolveVersion(url, "latest");
}

async function getChangeSummary(
  parsed: ParsedSource,
  fromVersion: string,
  toVersion: string,
): Promise<string[]> {
  // Clone repository to get git log
  try {
    const url =
      parsed.provider === "github" || parsed.provider === "gitlab"
        ? parsed.url
        : parsed.provider === "git"
          ? parsed.url
          : "";

    if (!url) {
      return [`Updated from ${fromVersion} to ${toVersion}`];
    }

    const clonedSource = await cloneGitSource({
      url,
      ref: toVersion,
      subpath: parsed.provider !== "local" && "subpath" in parsed ? parsed.subpath : undefined,
    });

    const simpleGit = (await import("simple-git")).default;
    const git = simpleGit(clonedSource.localPath);

    // Get commit log between versions
    const log = await git.log({
      from: fromVersion,
      to: toVersion,
      maxCount: 5, // Limit to 5 most recent changes
    });

    return log.all.map((commit: { message: string }) => commit.message.split("\n")[0]); // First line of each commit message
  } catch {
    // Fallback: return version diff only
    return [`Updated from ${fromVersion} to ${toVersion}`];
  }
}
