import type { SourceProfileInfo } from "@baton-dx/core";
import { describe, expect, it } from "vitest";
import {
  buildChildrenMap,
  buildHierarchicalSelectOptions,
  buildParentMap,
  buildProfileTree,
  getAncestors,
  getDescendants,
} from "./profile-tree.js";

const profiles: SourceProfileInfo[] = [
  { name: "base", path: "profiles/base", version: "1.0.0" },
  { name: "react", path: "profiles/react", version: "1.0.0", extends: "base" },
  { name: "vue", path: "profiles/vue", version: "1.0.0", extends: "base" },
  { name: "nextjs", path: "profiles/nextjs", version: "1.0.0", extends: "react" },
  { name: "nextjs-payload", path: "profiles/nextjs-payload", version: "1.0.0", extends: "nextjs" },
];

describe("buildParentMap", () => {
  it("maps children to their parent names", () => {
    const map = buildParentMap(profiles);
    expect(map.get("react")).toBe("base");
    expect(map.get("vue")).toBe("base");
    expect(map.get("nextjs")).toBe("react");
    expect(map.get("nextjs-payload")).toBe("nextjs");
  });

  it("does not include root profiles", () => {
    const map = buildParentMap(profiles);
    expect(map.has("base")).toBe(false);
  });

  it("handles empty profiles list", () => {
    const map = buildParentMap([]);
    expect(map.size).toBe(0);
  });
});

describe("buildChildrenMap", () => {
  it("maps parents to their direct children", () => {
    const map = buildChildrenMap(profiles);
    expect(map.get("base")).toEqual(["react", "vue"]);
    expect(map.get("react")).toEqual(["nextjs"]);
    expect(map.get("nextjs")).toEqual(["nextjs-payload"]);
  });

  it("does not include leaf profiles", () => {
    const map = buildChildrenMap(profiles);
    expect(map.has("vue")).toBe(false);
    expect(map.has("nextjs-payload")).toBe(false);
  });
});

describe("getAncestors", () => {
  it("returns transitive ancestors (parent first, root last)", () => {
    const parentMap = buildParentMap(profiles);
    expect(getAncestors("nextjs", parentMap)).toEqual(["react", "base"]);
    expect(getAncestors("nextjs-payload", parentMap)).toEqual(["nextjs", "react", "base"]);
  });

  it("returns direct parent for depth-1 profile", () => {
    const parentMap = buildParentMap(profiles);
    expect(getAncestors("react", parentMap)).toEqual(["base"]);
  });

  it("returns empty array for root profile", () => {
    const parentMap = buildParentMap(profiles);
    expect(getAncestors("base", parentMap)).toEqual([]);
  });

  it("returns empty for unknown profile", () => {
    const parentMap = buildParentMap(profiles);
    expect(getAncestors("unknown", parentMap)).toEqual([]);
  });
});

describe("getDescendants", () => {
  it("returns all transitive descendants in BFS order", () => {
    const childrenMap = buildChildrenMap(profiles);
    expect(getDescendants("base", childrenMap)).toEqual([
      "react",
      "vue",
      "nextjs",
      "nextjs-payload",
    ]);
  });

  it("returns direct descendants for mid-level profile", () => {
    const childrenMap = buildChildrenMap(profiles);
    expect(getDescendants("react", childrenMap)).toEqual(["nextjs", "nextjs-payload"]);
  });

  it("returns empty array for leaf profile", () => {
    const childrenMap = buildChildrenMap(profiles);
    expect(getDescendants("vue", childrenMap)).toEqual([]);
    expect(getDescendants("nextjs-payload", childrenMap)).toEqual([]);
  });

  it("returns empty for unknown profile", () => {
    const childrenMap = buildChildrenMap(profiles);
    expect(getDescendants("unknown", childrenMap)).toEqual([]);
  });
});

describe("buildHierarchicalSelectOptions", () => {
  it("includes name field in each option", () => {
    const roots = buildProfileTree(profiles);
    const options = buildHierarchicalSelectOptions(roots);
    expect(options[0].name).toBe("base");
    expect(options[1].name).toBe("react");
    expect(options[2].name).toBe("nextjs");
  });
});
