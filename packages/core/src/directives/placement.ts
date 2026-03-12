import { join, normalize } from "node:path";

const INCLUDES_DIR = ".baton/includes";

/**
 * Compute the target path for a file placement under .baton/includes/.
 */
export function computePlacementTarget(profileName: string, relativeSrc: string): string {
    return join(INCLUDES_DIR, profileName, normalize(relativeSrc));
}
