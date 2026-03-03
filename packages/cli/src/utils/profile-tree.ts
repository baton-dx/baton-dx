import type { SourceProfileInfo } from "@baton-dx/core";

/**
 * A node in the profile inheritance tree
 */
export interface ProfileTreeNode {
    profile: SourceProfileInfo;
    children: ProfileTreeNode[];
}

/**
 * Builds a tree structure from flat profile data.
 *
 * Algorithm:
 * 1. Create nodes for all profiles
 * 2. For each profile with `extends`, find the first known parent and attach as child
 * 3. Profiles without a known parent become roots
 *
 * Diamond inheritance: each profile appears only once (under its first known parent).
 * Orphan profiles (extends unknown profile): treated as roots.
 */
export function buildProfileTree(profiles: SourceProfileInfo[]): ProfileTreeNode[] {
    const nameToNode = new Map<string, ProfileTreeNode>();

    for (const profile of profiles) {
        nameToNode.set(profile.name, { profile, children: [] });
    }

    const hasParent = new Set<string>();

    for (const profile of profiles) {
        const parentName = profile.extends;
        if (parentName) {
            const parentNode = nameToNode.get(parentName);
            const currentNode = nameToNode.get(profile.name);
            if (parentNode && currentNode) {
                parentNode.children.push(currentNode);
                hasParent.add(profile.name);
            }
        }
    }

    const roots: ProfileTreeNode[] = [];
    for (const profile of profiles) {
        if (!hasParent.has(profile.name)) {
            const node = nameToNode.get(profile.name);
            if (node) roots.push(node);
        }
    }

    return roots;
}

/**
 * Renders a tree as an ASCII string for display.
 *
 * Example output:
 *   base
 *     └─ react (10)
 *       └─ nextjs (30)
 *     └─ vue (10)
 *   standalone
 */
export function renderProfileTree(roots: ProfileTreeNode[]): string {
    const lines: string[] = [];

    function renderNode(node: ProfileTreeNode, depth: number): void {
        const weight = node.profile.weight;
        const weightStr = weight !== undefined && weight !== 0 ? ` (${weight})` : "";
        const indent = "  ".repeat(depth);
        const prefix = depth > 0 ? `${indent}└─ ` : "";
        const description = node.profile.description ? `  — ${node.profile.description}` : "";
        lines.push(`${prefix}${node.profile.name}${weightStr}${description}`);

        for (const child of node.children) {
            renderNode(child, depth + 1);
        }
    }

    for (const root of roots) {
        renderNode(root, 0);
    }

    return lines.join("\n");
}

/**
 * Returns all transitively inherited parent profiles for the given selected names.
 * Only returns profiles that are NOT in the selected set.
 *
 * Used to show a post-selection note: "These profiles will also be synced via inheritance."
 */
export function getInheritedProfiles(
    selectedNames: string[],
    allProfiles: SourceProfileInfo[],
): string[] {
    const selectedSet = new Set(selectedNames);
    const inherited = new Set<string>();
    const nameToProfile = new Map<string, SourceProfileInfo>();

    for (const profile of allProfiles) {
        nameToProfile.set(profile.name, profile);
    }

    function collectParents(name: string): void {
        const profile = nameToProfile.get(name);
        const parentName = profile?.extends;
        if (parentName && !selectedSet.has(parentName) && !inherited.has(parentName)) {
            inherited.add(parentName);
            collectParents(parentName);
        }
    }

    for (const selectedName of selectedNames) {
        collectParents(selectedName);
    }

    return [...inherited];
}

/**
 * Creates options for p.multiselect / p.select with hierarchical indentation.
 *
 * Example labels:
 *   depth 0: "base"
 *   depth 1: "  └─ react (10)"
 *   depth 2: "    └─ nextjs (30)"
 */
export function buildHierarchicalSelectOptions(
    roots: ProfileTreeNode[],
): Array<{ value: string; label: string; hint?: string; name: string }> {
    const options: Array<{ value: string; label: string; hint?: string; name: string }> = [];

    function processNode(node: ProfileTreeNode, depth: number): void {
        const weight = node.profile.weight;
        const weightStr = weight !== undefined && weight !== 0 ? ` (${weight})` : "";
        const indent = "  ".repeat(depth);
        const prefix = depth > 0 ? `${indent}└─ ` : "";
        const label = `${prefix}${node.profile.name}${weightStr}`;

        options.push({
            value: node.profile.path,
            label,
            hint: node.profile.description
                ? `${node.profile.description} (v${node.profile.version})`
                : `v${node.profile.version}`,
            name: node.profile.name,
        });

        for (const child of node.children) {
            processNode(child, depth + 1);
        }
    }

    for (const root of roots) {
        processNode(root, 0);
    }

    return options;
}

/**
 * Builds a map from profile name to its parent (extends) name.
 * Root profiles (no extends) are not included.
 */
export function buildParentMap(profiles: SourceProfileInfo[]): Map<string, string> {
    const map = new Map<string, string>();
    for (const profile of profiles) {
        if (profile.extends) {
            map.set(profile.name, profile.extends);
        }
    }
    return map;
}

/**
 * Builds a map from profile name to its direct children names.
 * Profiles with no children are not included.
 */
export function buildChildrenMap(profiles: SourceProfileInfo[]): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const profile of profiles) {
        if (profile.extends) {
            const children = map.get(profile.extends);
            if (children) {
                children.push(profile.name);
            } else {
                map.set(profile.extends, [profile.name]);
            }
        }
    }
    return map;
}

/**
 * Returns all transitive ancestors of a profile (parent first, root last).
 */
export function getAncestors(name: string, parentMap: Map<string, string>): string[] {
    const ancestors: string[] = [];
    let current = parentMap.get(name);
    while (current) {
        ancestors.push(current);
        current = parentMap.get(current);
    }
    return ancestors;
}

/**
 * Returns all transitive descendants of a profile (BFS order).
 */
export function getDescendants(name: string, childrenMap: Map<string, string[]>): string[] {
    const descendants: string[] = [];
    const queue = childrenMap.get(name)?.slice() ?? [];
    while (queue.length > 0) {
        const child = queue.shift() as string;
        descendants.push(child);
        const grandchildren = childrenMap.get(child);
        if (grandchildren) {
            queue.push(...grandchildren);
        }
    }
    return descendants;
}
