import { describe, expect, test } from "vitest";
import type { ResolvedProfile } from "../inheritance/profile-chain.js";
import type { ProfileManifest } from "../schemas/profile-manifest.js";
import { mergeMcp, mergeMcpWithWarnings } from "./mcp.js";

/** Minimal ResolvedProfile factory */
function makeProfile(
  name: string,
  servers: Array<{
    name: string;
    command?: string;
    scope?: "project" | "global";
    tools?: string[];
  }>,
  opts: { weight?: number; scope?: "project" | "global" } = {},
): ResolvedProfile {
  const weight = opts.weight ?? 0;
  return {
    name,
    source: "local:/tmp/test",
    localPath: "/tmp/test",
    manifest: {
      version: "1.0.0",
      scope: opts.scope ?? "project",
      weight,
      ai: {
        mcp: servers.map((s) => ({
          name: s.name,
          command: s.command ?? "npx",
          args: [],
          scope: s.scope,
          tools: s.tools,
        })),
      },
    } as ProfileManifest,
  };
}

describe("mergeMcp", () => {
  test("empty profiles returns empty array", () => {
    const result = mergeMcp([]);
    expect(result).toEqual([]);
  });

  test("single profile returns its servers", () => {
    const profile = makeProfile("base", [{ name: "github", command: "npx" }]);
    const result = mergeMcp([profile]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("github");
    expect(result[0].profileName).toBe("base");
  });

  test("last-wins by weight — higher weight profile overrides lower", () => {
    const base = makeProfile("base", [{ name: "github", command: "npx-base" }], { weight: 0 });
    const override = makeProfile(
      "override",
      [{ name: "github", command: "npx-override" }],
      { weight: 10 },
    );
    // sortProfilesByWeight puts higher weight last (last-wins)
    const result = mergeMcp([base, override]);
    expect(result).toHaveLength(1);
    expect(result[0].command).toBe("npx-override");
    expect(result[0].profileName).toBe("override");
  });

  test("multiple profiles — different server names are accumulated", () => {
    const base = makeProfile("base", [{ name: "github" }], { weight: 0 });
    const extra = makeProfile("extra", [{ name: "filesystem" }], { weight: 5 });
    const result = mergeMcp([base, extra]);
    expect(result).toHaveLength(2);
    const names = result.map((s) => s.name);
    expect(names).toContain("github");
    expect(names).toContain("filesystem");
  });

  test("scope resolves to server scope if set, else profile scope", () => {
    const withScope = makeProfile(
      "p",
      [{ name: "global-server", scope: "global" }, { name: "default-server" }],
      { scope: "project" },
    );
    const result = mergeMcp([withScope]);
    const globalOne = result.find((s) => s.name === "global-server");
    const defaultOne = result.find((s) => s.name === "default-server");
    expect(globalOne?.scope).toBe("global");
    expect(defaultOne?.scope).toBe("project");
  });
});

describe("mergeMcpWithWarnings", () => {
  test("no warnings when profiles have different weights", () => {
    const base = makeProfile("base", [{ name: "github" }], { weight: 0 });
    const top = makeProfile("top", [{ name: "github" }], { weight: 10 });
    const { warnings } = mergeMcpWithWarnings([base, top]);
    expect(warnings).toHaveLength(0);
  });

  test("same-weight conflict generates warning", () => {
    const a = makeProfile("profileA", [{ name: "github" }], { weight: 5 });
    const b = makeProfile("profileB", [{ name: "github" }], { weight: 5 });
    const { warnings } = mergeMcpWithWarnings([a, b]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].key).toBe("github");
    expect(warnings[0].profileA).toBe("profileA");
    expect(warnings[0].profileB).toBe("profileB");
    expect(warnings[0].weight).toBe(5);
    expect(warnings[0].category).toBe("mcp");
  });

  test("locked profile (weight -1) cannot be overridden", () => {
    const locked = makeProfile("locked", [{ name: "github", command: "locked-cmd" }], {
      weight: -1,
    });
    const override = makeProfile("override", [{ name: "github", command: "override-cmd" }], {
      weight: 10,
    });
    // locked comes first in array; weight-sort puts -1 first, so locked is first, override tries after
    const { servers } = mergeMcpWithWarnings([locked, override]);
    expect(servers).toHaveLength(1);
    expect(servers[0].command).toBe("locked-cmd");
  });

  test("empty profiles returns empty servers and no warnings", () => {
    const { servers, warnings } = mergeMcpWithWarnings([]);
    expect(servers).toEqual([]);
    expect(warnings).toEqual([]);
  });
});
