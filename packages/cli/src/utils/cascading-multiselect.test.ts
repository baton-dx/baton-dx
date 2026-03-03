import type { SourceProfileInfo } from "@baton-dx/core";
import { describe, expect, it } from "vitest";
import { applyCascade } from "./cascading-multiselect.js";
import { buildChildrenMap, buildParentMap } from "./profile-tree.js";

const profiles: SourceProfileInfo[] = [
    { name: "base", path: "profiles/base", version: "1.0.0" },
    { name: "react", path: "profiles/react", version: "1.0.0", extends: "base" },
    { name: "vue", path: "profiles/vue", version: "1.0.0", extends: "base" },
    { name: "nextjs", path: "profiles/nextjs", version: "1.0.0", extends: "react" },
    {
        name: "nextjs-payload",
        path: "profiles/nextjs-payload",
        version: "1.0.0",
        extends: "nextjs",
    },
];

const parentMap = buildParentMap(profiles);
const childrenMap = buildChildrenMap(profiles);

// name <-> value maps (value = path)
const nameToValue = new Map<string, string>();
const valueToName = new Map<string, string>();
for (const p of profiles) {
    nameToValue.set(p.name, p.path);
    valueToName.set(p.path, p.name);
}

const v = (name: string) => nameToValue.get(name) as string;

describe("applyCascade", () => {
    it("selecting a leaf auto-selects all ancestors", () => {
        const prev: string[] = [];
        const curr = [v("nextjs")];

        const result = applyCascade(prev, curr, parentMap, childrenMap, nameToValue, valueToName);

        expect(result).toContain(v("nextjs"));
        expect(result).toContain(v("react"));
        expect(result).toContain(v("base"));
    });

    it("deselecting a mid-node removes all descendants but keeps ancestors", () => {
        const prev = [v("base"), v("react"), v("nextjs"), v("nextjs-payload")];
        const curr = [v("base"), v("nextjs"), v("nextjs-payload")]; // react removed

        const result = applyCascade(prev, curr, parentMap, childrenMap, nameToValue, valueToName);

        expect(result).toContain(v("base"));
        expect(result).not.toContain(v("react"));
        expect(result).not.toContain(v("nextjs"));
        expect(result).not.toContain(v("nextjs-payload"));
    });

    it("selecting root adds no ancestors", () => {
        const prev: string[] = [];
        const curr = [v("base")];

        const result = applyCascade(prev, curr, parentMap, childrenMap, nameToValue, valueToName);

        expect(result).toEqual([v("base")]);
    });

    it("deselecting root removes all descendants", () => {
        const prev = [v("base"), v("react"), v("vue"), v("nextjs")];
        const curr = [v("react"), v("vue"), v("nextjs")]; // base removed

        const result = applyCascade(prev, curr, parentMap, childrenMap, nameToValue, valueToName);

        expect(result).toEqual([]);
    });

    it("selecting already-selected profile is idempotent", () => {
        const prev = [v("base"), v("react")];
        const curr = [v("base"), v("react")];

        const result = applyCascade(prev, curr, parentMap, childrenMap, nameToValue, valueToName);

        expect(result).toEqual([v("base"), v("react")]);
    });

    it("sibling is not affected by selection", () => {
        const prev = [v("base"), v("vue")];
        const curr = [v("base"), v("vue"), v("nextjs")]; // nextjs added

        const result = applyCascade(prev, curr, parentMap, childrenMap, nameToValue, valueToName);

        expect(result).toContain(v("vue"));
        expect(result).toContain(v("nextjs"));
        expect(result).toContain(v("react")); // ancestor of nextjs
        expect(result).toContain(v("base"));
    });

    it("sibling is not affected by deselection", () => {
        const prev = [v("base"), v("react"), v("vue"), v("nextjs")];
        const curr = [v("base"), v("vue"), v("nextjs")]; // react removed

        const result = applyCascade(prev, curr, parentMap, childrenMap, nameToValue, valueToName);

        expect(result).toContain(v("vue"));
        expect(result).toContain(v("base"));
        expect(result).not.toContain(v("react"));
        expect(result).not.toContain(v("nextjs")); // descendant of react
    });

    it("selecting deepest leaf cascades through entire chain", () => {
        const prev: string[] = [];
        const curr = [v("nextjs-payload")];

        const result = applyCascade(prev, curr, parentMap, childrenMap, nameToValue, valueToName);

        expect(result).toContain(v("nextjs-payload"));
        expect(result).toContain(v("nextjs"));
        expect(result).toContain(v("react"));
        expect(result).toContain(v("base"));
        expect(result).not.toContain(v("vue"));
    });
});
