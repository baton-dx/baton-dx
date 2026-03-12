import { describe, expect, it } from "vitest";
import { computePlacementTarget } from "./placement.js";

describe("computePlacementTarget", () => {
    it("computes target path under .baton/includes/{profileName}", () => {
        const result = computePlacementTarget("my-profile", "fragments/react.md");
        expect(result).toBe(".baton/includes/my-profile/fragments/react.md");
    });

    it("normalizes path separators", () => {
        const result = computePlacementTarget("team", "deep/nested/file.md");
        expect(result).toBe(".baton/includes/team/deep/nested/file.md");
    });

    it("handles single file without directory", () => {
        const result = computePlacementTarget("base", "rules.md");
        expect(result).toBe(".baton/includes/base/rules.md");
    });
});
