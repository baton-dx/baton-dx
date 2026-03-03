import { access } from "node:fs/promises";
import { getGlobalConfigPath } from "./global-config.js";

/**
 * Returns true when no global config exists yet — meaning the user
 * has never run `baton init` or any command that creates ~/.baton/config.yaml.
 */
export async function isFirstRun(): Promise<boolean> {
    try {
        await access(getGlobalConfigPath());
        return false;
    } catch {
        return true;
    }
}
