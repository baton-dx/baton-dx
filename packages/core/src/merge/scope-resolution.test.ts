import { describe, expect, test } from "vitest";
import { resolveScope } from "./scope-resolution.js";

describe("resolveScope", () => {
    test("both undefined → defaults to 'project'", () => {
        expect(resolveScope(undefined, undefined)).toBe("project");
    });

    test("only profileScope set → profileScope wins", () => {
        expect(resolveScope(undefined, "global")).toBe("global");
        expect(resolveScope(undefined, "project")).toBe("project");
    });

    test("only itemScope set → itemScope wins", () => {
        expect(resolveScope("global", undefined)).toBe("global");
        expect(resolveScope("project", undefined)).toBe("project");
    });

    test("both set → itemScope takes priority", () => {
        expect(resolveScope("global", "project")).toBe("global");
        expect(resolveScope("project", "global")).toBe("project");
    });

    test("same values → correct result", () => {
        expect(resolveScope("project", "project")).toBe("project");
        expect(resolveScope("global", "global")).toBe("global");
    });
});
