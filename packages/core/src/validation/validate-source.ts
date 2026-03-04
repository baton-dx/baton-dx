import { access, readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { getAllAIToolKeys } from "@baton-dx/ai-tool-paths";
import { parse as parseYaml } from "yaml";
import { profileManifestSchema } from "../schemas/profile-manifest.js";
import { sourceManifestSchema } from "../schemas/source-manifest.js";
import type { ValidationIssue, ValidationReport } from "./types.js";

/**
 * Check whether a path exists on disk.
 */
async function pathExists(filePath: string): Promise<boolean> {
    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Recursively collect all .md files under a directory.
 */
async function collectMdFiles(dir: string): Promise<string[]> {
    const results: string[] = [];
    try {
        const entries = await readdir(dir, { withFileTypes: true, encoding: "utf-8" });
        for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
                const nested = await collectMdFiles(fullPath);
                results.push(...nested);
            } else if (entry.name.endsWith(".md")) {
                results.push(fullPath);
            }
        }
    } catch {
        // Skip directories that can't be read
    }
    return results;
}

/**
 * Extract all {{varName}} references from a string.
 */
function extractVariableReferences(content: string): string[] {
    const varRegex = /\{\{(\w+)\}\}/g;
    const matches = content.matchAll(varRegex);
    return Array.from(matches, (m) => m[1]);
}

/**
 * Validates a Baton source repository, checking the source manifest,
 * profile manifests, referenced files, and consistency.
 *
 * Returns a ValidationReport with all discovered issues.
 *
 * @param sourceRoot - Absolute path to the source repository root
 */
export async function validateSource(sourceRoot: string): Promise<ValidationReport> {
    const issues: ValidationIssue[] = [];
    let profilesChecked = 0;

    // ── Check 1: Source manifest exists ────────────────────────────────
    const sourceManifestPath = join(sourceRoot, "baton.source.yaml");
    let rawSourceManifest: unknown;

    try {
        const content = await readFile(sourceManifestPath, "utf-8");
        rawSourceManifest = parseYaml(content);
    } catch {
        issues.push({
            severity: "error",
            message: "Source manifest (baton.source.yaml) not found",
            path: "baton.source.yaml",
            context: "source-manifest",
        });
        return buildReport(issues, profilesChecked);
    }

    // ── Check 2: Source manifest is schema-valid ───────────────────────
    const sourceResult = sourceManifestSchema.safeParse(rawSourceManifest);
    if (!sourceResult.success) {
        for (const issue of sourceResult.error.issues) {
            issues.push({
                severity: "error",
                message: `Source manifest schema error: ${issue.message} (at ${issue.path.join(".")})`,
                path: "baton.source.yaml",
                context: "source-manifest",
            });
        }
        return buildReport(issues, profilesChecked);
    }

    const sourceManifest = sourceResult.data;

    // ── Check 5: AI tool keys are known (source-level) ────────────────
    const knownKeys = getAllAIToolKeys();
    if (sourceManifest.ai?.tools) {
        for (const tool of sourceManifest.ai.tools) {
            if (tool === "*") continue; // wildcard — matches all tools
            if (!knownKeys.includes(tool)) {
                issues.push({
                    severity: "warning",
                    message: `Unknown AI tool key "${tool}" in source manifest`,
                    path: "baton.source.yaml",
                    context: "source-manifest",
                });
            }
        }
    }

    // ── Determine profiles to check ────────────────────────────────────
    // If profiles are explicitly declared, use those. Otherwise auto-discover.
    interface ProfileEntry {
        name: string;
        path: string;
    }

    let declaredProfiles: ProfileEntry[] | undefined;

    if (sourceManifest.profiles && sourceManifest.profiles.length > 0) {
        declaredProfiles = sourceManifest.profiles;
    }

    const profilesToCheck: ProfileEntry[] =
        declaredProfiles ?? (await discoverProfiles(sourceRoot));

    // Collect validated profiles for cross-profile checks (extends loop, weight conflicts)
    const validatedProfiles: Array<{ name: string; extends?: string; weight: number }> = [];

    // ── Check 3: Declared profile directories exist ────────────────────
    for (const profile of profilesToCheck) {
        const profileDir = join(sourceRoot, profile.path);
        if (!(await pathExists(profileDir))) {
            issues.push({
                severity: "error",
                message: `Declared profile directory does not exist: ${profile.path}`,
                path: profile.path,
                context: `profile:${profile.name}`,
            });
            continue;
        }

        // ── Check 4: Profile manifest is schema-valid ──────────────────
        const profileManifestPath = join(profileDir, "baton.profile.yaml");
        let rawProfileManifest: unknown;

        try {
            const content = await readFile(profileManifestPath, "utf-8");
            rawProfileManifest = parseYaml(content);
        } catch {
            issues.push({
                severity: "error",
                message: `Profile manifest (baton.profile.yaml) not found in ${profile.path}`,
                path: join(profile.path, "baton.profile.yaml"),
                context: `profile:${profile.name}`,
            });
            profilesChecked++;
            continue;
        }

        const profileResult = profileManifestSchema.safeParse(rawProfileManifest);
        if (!profileResult.success) {
            for (const issue of profileResult.error.issues) {
                issues.push({
                    severity: "error",
                    message: `Profile manifest schema error: ${issue.message} (at ${issue.path.join(".")})`,
                    path: join(profile.path, "baton.profile.yaml"),
                    context: `profile:${profile.name}`,
                });
            }
            profilesChecked++;
            continue;
        }

        const profileManifest = profileResult.data;
        profilesChecked++;
        const ctx = `profile:${profile.name}`;

        // Track for cross-profile validation
        validatedProfiles.push({
            name: profileManifest.name,
            extends: profileManifest.extends,
            weight: profileManifest.weight ?? 0,
        });

        // ── Check 5 (profile-level): AI tool keys ──────────────────────
        if (profileManifest.ai?.tools) {
            for (const tool of profileManifest.ai.tools) {
                if (tool === "*") continue; // wildcard — matches all tools
                if (!knownKeys.includes(tool)) {
                    issues.push({
                        severity: "warning",
                        message: `Unknown AI tool key "${tool}"`,
                        path: join(profile.path, "baton.profile.yaml"),
                        context: ctx,
                    });
                }
            }
        }

        // ── Check 6: Skills exist ──────────────────────────────────────
        if (profileManifest.ai?.skills) {
            for (const skill of profileManifest.ai.skills) {
                const skillMd = join(profileDir, "ai", "skills", skill.name, "SKILL.md");
                if (!(await pathExists(skillMd))) {
                    issues.push({
                        severity: "warning",
                        message: `Skill file missing: ai/skills/${skill.name}/SKILL.md`,
                        path: join(profile.path, "ai", "skills", skill.name, "SKILL.md"),
                        context: ctx,
                    });
                }
            }
        }

        // ── Check 7: Rules exist ───────────────────────────────────────
        if (profileManifest.ai?.rules) {
            const rules = profileManifest.ai.rules;
            if (Array.isArray(rules)) {
                // Universal rules: ai/rules/universal/{name}.md
                for (const name of rules) {
                    const rulePath = join(profileDir, "ai", "rules", "universal", `${name}.md`);
                    if (!(await pathExists(rulePath))) {
                        issues.push({
                            severity: "warning",
                            message: `Rule file missing: ai/rules/universal/${name}.md`,
                            path: join(profile.path, "ai", "rules", "universal", `${name}.md`),
                            context: ctx,
                        });
                    }
                }
            } else {
                // Scoped rules: ai/rules/{scope}/{name}.md
                for (const [scope, names] of Object.entries(rules)) {
                    if (!names) continue;
                    for (const name of names) {
                        const rulePath = join(profileDir, "ai", "rules", scope, `${name}.md`);
                        if (!(await pathExists(rulePath))) {
                            issues.push({
                                severity: "warning",
                                message: `Rule file missing: ai/rules/${scope}/${name}.md`,
                                path: join(profile.path, "ai", "rules", scope, `${name}.md`),
                                context: ctx,
                            });
                        }
                    }
                }
            }
        }

        // ── Check 8: Agents exist ──────────────────────────────────────
        if (profileManifest.ai?.agents) {
            const agents = profileManifest.ai.agents;
            if (Array.isArray(agents)) {
                // Universal agents: ai/agents/{name}.md
                for (const name of agents) {
                    const agentPath = join(profileDir, "ai", "agents", `${name}.md`);
                    if (!(await pathExists(agentPath))) {
                        issues.push({
                            severity: "warning",
                            message: `Agent file missing: ai/agents/${name}.md`,
                            path: join(profile.path, "ai", "agents", `${name}.md`),
                            context: ctx,
                        });
                    }
                }
            } else {
                // Scoped agents: ai/agents/{scope}/{name}.md
                for (const [scope, names] of Object.entries(agents)) {
                    if (!names) continue;
                    for (const name of names) {
                        const agentPath = join(profileDir, "ai", "agents", scope, `${name}.md`);
                        if (!(await pathExists(agentPath))) {
                            issues.push({
                                severity: "warning",
                                message: `Agent file missing: ai/agents/${scope}/${name}.md`,
                                path: join(profile.path, "ai", "agents", scope, `${name}.md`),
                                context: ctx,
                            });
                        }
                    }
                }
            }
        }

        // ── Check 9: Memory exists ─────────────────────────────────────
        if (profileManifest.ai?.memory) {
            for (const mem of profileManifest.ai.memory) {
                const memPath = join(profileDir, "ai", "memory", mem.source);
                if (!(await pathExists(memPath))) {
                    issues.push({
                        severity: "warning",
                        message: `Memory file missing: ai/memory/${mem.source}`,
                        path: join(profile.path, "ai", "memory", mem.source),
                        context: ctx,
                    });
                }
            }
        }

        // ── Check 10: Commands exist ───────────────────────────────────
        if (profileManifest.ai?.commands) {
            for (const cmd of profileManifest.ai.commands) {
                const cmdPath = join(profileDir, "ai", "commands", `${cmd}.md`);
                if (!(await pathExists(cmdPath))) {
                    issues.push({
                        severity: "warning",
                        message: `Command file missing: ai/commands/${cmd}.md`,
                        path: join(profile.path, "ai", "commands", `${cmd}.md`),
                        context: ctx,
                    });
                }
            }
        }

        // ── Check 11: Files exist ──────────────────────────────────────
        if (profileManifest.files) {
            for (const file of profileManifest.files) {
                const filePath = join(profileDir, "files", file.source);
                if (!(await pathExists(filePath))) {
                    issues.push({
                        severity: "warning",
                        message: `File missing: files/${file.source}`,
                        path: join(profile.path, "files", file.source),
                        context: ctx,
                    });
                }
            }
        }

        // ── Check 12: IDE files exist ──────────────────────────────────
        if (profileManifest.ide) {
            for (const [platform, files] of Object.entries(profileManifest.ide)) {
                for (const file of files) {
                    const idePath = join(profileDir, "ide", platform, file);
                    if (!(await pathExists(idePath))) {
                        issues.push({
                            severity: "warning",
                            message: `IDE file missing: ide/${platform}/${file}`,
                            path: join(profile.path, "ide", platform, file),
                            context: ctx,
                        });
                    }
                }
            }
        }

        // ── Check 13: Extends references are resolvable ────────────────
        if (profileManifest.extends) {
            const parentName = profileManifest.extends;
            const siblingDir = join(profileDir, "..", parentName);
            const siblingManifest = join(siblingDir, "baton.profile.yaml");
            if (!(await pathExists(siblingManifest))) {
                issues.push({
                    severity: "error",
                    message: `Profile "${profileManifest.name}" extends "${parentName}" — no sibling profile with that name found`,
                    path: join("profiles", parentName, "baton.profile.yaml"),
                    context: ctx,
                });
            }
        }

        // ── Check 14: Undefined variables ──────────────────────────────
        const declaredVars = new Set(Object.keys(profileManifest.variables ?? {}));
        const mdFiles = await collectMdFiles(profileDir);

        for (const mdFile of mdFiles) {
            const content = await readFile(mdFile, "utf-8");
            const varNames = extractVariableReferences(content);
            const undeclaredInFile = new Set(varNames.filter((v) => !declaredVars.has(v)));
            for (const varName of undeclaredInFile) {
                const relPath = relative(sourceRoot, mdFile);
                issues.push({
                    severity: "warning",
                    message: `Undefined variable "{{${varName}}}" in ${relPath}`,
                    path: relPath,
                    context: ctx,
                });
            }
        }
    }

    // ── Check 16: Extend-Loop-Erkennung ──────────────────────────────
    const extendsGraph = new Map<string, string>();
    for (const p of validatedProfiles) {
        if (p.extends) extendsGraph.set(p.name, p.extends);
    }

    for (const startName of extendsGraph.keys()) {
        const cyclePath: string[] = [startName];
        const seen = new Set<string>([startName]);
        let current = extendsGraph.get(startName);
        while (current !== undefined) {
            if (seen.has(current)) {
                const cycleStart = cyclePath.indexOf(current);
                const cycle = [...cyclePath.slice(cycleStart), current].join(" → ");
                issues.push({
                    severity: "error",
                    message: `Extend loop detected: ${cycle}`,
                    context: `profile:${startName}`,
                });
                break;
            }
            seen.add(current);
            cyclePath.push(current);
            current = extendsGraph.get(current);
        }
    }

    // ── Check 17: Weight-Konflikt unter Geschwisterprofilen ──────────
    const profilesByParent = new Map<string | null, typeof validatedProfiles>();
    for (const p of validatedProfiles) {
        const key = p.extends ?? null;
        const group = profilesByParent.get(key) ?? [];
        group.push(p);
        profilesByParent.set(key, group);
    }

    for (const [parentName, siblings] of profilesByParent) {
        if (siblings.length < 2) continue;
        const weightGroups = new Map<number, string[]>();
        for (const s of siblings) {
            const names = weightGroups.get(s.weight) ?? [];
            names.push(s.name);
            weightGroups.set(s.weight, names);
        }
        for (const [weight, names] of weightGroups) {
            if (names.length > 1) {
                const parentLabel = parentName ? `"${parentName}"` : "none (root level)";
                issues.push({
                    severity: "warning",
                    message: `Sibling profiles [${names.join(", ")}] share parent ${parentLabel} and weight ${weight} — last-installed wins`,
                    context: "source-manifest",
                });
            }
        }
    }

    // ── Check 15: Orphaned profiles ──────────────────────────────────
    if (declaredProfiles) {
        const declaredPaths = new Set(declaredProfiles.map((p) => p.path));
        const diskProfiles = await discoverProfiles(sourceRoot);
        for (const diskProfile of diskProfiles) {
            if (!declaredPaths.has(diskProfile.path)) {
                issues.push({
                    severity: "warning",
                    message: `Orphaned profile on disk not declared in source manifest: ${diskProfile.path}`,
                    path: diskProfile.path,
                    context: "source-manifest",
                });
            }
        }
    }

    return buildReport(issues, profilesChecked);
}

/**
 * Auto-discover profiles by scanning the profiles/ directory for
 * subdirectories that contain baton.profile.yaml.
 */
async function discoverProfiles(
    sourceRoot: string,
): Promise<Array<{ name: string; path: string }>> {
    const profilesDir = join(sourceRoot, "profiles");
    const results: Array<{ name: string; path: string }> = [];

    try {
        const entries = await readdir(profilesDir, { withFileTypes: true, encoding: "utf-8" });
        for (const entry of entries) {
            if (!entry.isDirectory() || entry.name.startsWith(".")) {
                continue;
            }
            const manifestPath = join(profilesDir, entry.name, "baton.profile.yaml");
            if (await pathExists(manifestPath)) {
                results.push({
                    name: entry.name,
                    path: join("profiles", entry.name),
                });
            }
        }
    } catch {
        // profiles/ directory doesn't exist — that's fine
    }

    return results;
}

/**
 * Build the final ValidationReport from a list of issues.
 */
function buildReport(issues: ValidationIssue[], profilesChecked: number): ValidationReport {
    const errors = issues.filter((i) => i.severity === "error").length;
    const warnings = issues.filter((i) => i.severity === "warning").length;

    return {
        valid: errors === 0,
        issues,
        summary: {
            errors,
            warnings,
            profilesChecked,
        },
    };
}
