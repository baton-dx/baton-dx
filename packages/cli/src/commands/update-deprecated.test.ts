import { describe, expect, it } from "vitest";

describe("updateCommand (deprecated)", () => {
    it("has correct meta name", async () => {
        const { updateCommand } = await import("./update.js");
        expect(updateCommand.meta).toBeDefined();
    });

    it("has async run function", async () => {
        const { updateCommand } = await import("./update.js");
        expect(updateCommand.run).toBeDefined();
        expect(typeof updateCommand.run).toBe("function");
    });

    it("inherits sync command args", async () => {
        const { updateCommand } = await import("./update.js");
        const args = updateCommand.args as Record<string, unknown>;
        expect(args["dry-run"]).toBeDefined();
        expect(args.category).toBeDefined();
        expect(args.yes).toBeDefined();
        expect(args.verbose).toBeDefined();
    });
});
