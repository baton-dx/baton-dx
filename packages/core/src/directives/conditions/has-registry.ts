import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * A has-characteristic detector function.
 * Returns true if the project has this characteristic.
 */
type HasDetector = (projectRoot: string, pkgJson: PackageJson | null) => Promise<boolean>;

interface PackageJson {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    workspaces?: unknown;
    [key: string]: unknown;
}

/** Check if a file exists. */
async function fileExists(projectRoot: string, ...segments: string[]): Promise<boolean> {
    try {
        await access(resolve(projectRoot, ...segments));
        return true;
    } catch {
        return false;
    }
}

/** Check if a package is in deps or devDeps. */
function hasDep(pkgJson: PackageJson | null, name: string): boolean {
    if (!pkgJson) return false;
    return name in (pkgJson.dependencies ?? {}) || name in (pkgJson.devDependencies ?? {});
}

/** Check any of multiple glob-like file patterns. */
async function anyFileExists(projectRoot: string, patterns: string[]): Promise<boolean> {
    for (const p of patterns) {
        if (await fileExists(projectRoot, p)) return true;
    }
    return false;
}

/**
 * Built-in has-characteristic registry.
 */
const HAS_REGISTRY: Record<string, HasDetector> = {
    typescript: async (root) => fileExists(root, "tsconfig.json"),
    react: async (_root, pkg) => hasDep(pkg, "react"),
    vue: async (_root, pkg) => hasDep(pkg, "vue"),
    next: async (_root, pkg) => hasDep(pkg, "next"),
    biome: async (root) => anyFileExists(root, ["biome.json", "biome.jsonc"]),
    eslint: async (root) =>
        anyFileExists(root, [
            "eslint.config.js",
            "eslint.config.mjs",
            "eslint.config.cjs",
            "eslint.config.ts",
            ".eslintrc",
            ".eslintrc.js",
            ".eslintrc.json",
            ".eslintrc.yml",
            ".eslintrc.yaml",
        ]),
    prettier: async (root, pkg) =>
        hasDep(pkg, "prettier") ||
        (await anyFileExists(root, [
            ".prettierrc",
            ".prettierrc.json",
            ".prettierrc.js",
            ".prettierrc.yml",
            ".prettierrc.yaml",
            ".prettierrc.toml",
            ".prettierrc.cjs",
            ".prettierrc.mjs",
            "prettier.config.js",
            "prettier.config.cjs",
            "prettier.config.mjs",
        ])),
    tailwind: async (_root, pkg) => hasDep(pkg, "tailwindcss"),
    monorepo: async (root, pkg) =>
        pkg?.workspaces != null || (await fileExists(root, "pnpm-workspace.yaml")),
    docker: async (root) => fileExists(root, "Dockerfile"),
    python: async (root) => anyFileExists(root, ["pyproject.toml", "requirements.txt"]),
    rust: async (root) => fileExists(root, "Cargo.toml"),
    go: async (root) => fileExists(root, "go.mod"),
};

/**
 * Cache for detection results per sync run.
 * Key format: `${projectRoot}::${characteristic}`
 */
const detectionCache = new Map<string, boolean>();

/** Read and cache package.json for a project root. */
const pkgJsonCache = new Map<string, PackageJson | null>();

async function getPackageJson(projectRoot: string): Promise<PackageJson | null> {
    if (pkgJsonCache.has(projectRoot)) return pkgJsonCache.get(projectRoot) ?? null;
    try {
        const content = await readFile(resolve(projectRoot, "package.json"), "utf-8");
        const parsed = JSON.parse(content) as PackageJson;
        pkgJsonCache.set(projectRoot, parsed);
        return parsed;
    } catch {
        pkgJsonCache.set(projectRoot, null);
        return null;
    }
}

/**
 * Detect if a project has a given characteristic.
 * Results are cached per sync run.
 */
export async function detectHas(projectRoot: string, key: string): Promise<boolean | undefined> {
    const detector = HAS_REGISTRY[key];
    if (!detector) return undefined;

    const cacheKey = `${projectRoot}::${key}`;
    if (detectionCache.has(cacheKey)) return detectionCache.get(cacheKey) ?? false;

    const pkgJson = await getPackageJson(projectRoot);
    const result = await detector(projectRoot, pkgJson);
    detectionCache.set(cacheKey, result);
    return result;
}

/** Clear detection caches (call between sync runs). */
export function clearHasCache(): void {
    detectionCache.clear();
    pkgJsonCache.clear();
}
