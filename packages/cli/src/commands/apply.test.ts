import { describe, expect, it } from "vitest";
import { applyCommand } from "./apply.js";

describe("applyCommand", () => {
    it("should export a valid command definition", () => {
        expect(applyCommand).toBeDefined();
        expect(applyCommand.meta).toBeDefined();
        expect(applyCommand.args).toBeDefined();
    });

    it("should have async run function", () => {
        expect(applyCommand.run).toBeDefined();
        expect(typeof applyCommand.run).toBe("function");
    });

    it("has expected CLI flags", () => {
        const args = applyCommand.args as Record<string, unknown>;
        expect(args["dry-run"]).toBeDefined();
        expect(args.category).toBeDefined();
        expect(args.yes).toBeDefined();
        expect(args.verbose).toBeDefined();
        expect(args.fresh).toBeDefined();
    });
});
