import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Read the Baton CLI version from the bundled package.json.
 * Returns "0.0.0" when the file cannot be read (e.g. during tests).
 */
export async function readCurrentVersion(): Promise<string> {
    try {
        // After bundling via tsdown to dist/index.mjs, __dirname resolves to the dist/
        // directory, so one level up reaches packages/cli/package.json.
        const pkg = JSON.parse(await readFile(join(__dirname, "../package.json"), "utf-8"));
        return typeof pkg.version === "string" ? pkg.version : "0.0.0";
    } catch {
        return "0.0.0";
    }
}
