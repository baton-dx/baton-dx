import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", () => ({
    access: vi.fn(),
}));

vi.mock("./global-config.js", () => ({
    getGlobalConfigPath: () => "/home/user/.baton/config.yaml",
}));

import { access } from "node:fs/promises";
import { isFirstRun } from "./first-run.js";

const mockAccess = access as unknown as ReturnType<typeof vi.fn>;

afterEach(() => {
    vi.clearAllMocks();
});

describe("isFirstRun", () => {
    it("returns true when config file does not exist", async () => {
        mockAccess.mockRejectedValue(new Error("ENOENT"));
        expect(await isFirstRun()).toBe(true);
    });

    it("returns false when config file exists", async () => {
        mockAccess.mockResolvedValue(undefined);
        expect(await isFirstRun()).toBe(false);
    });
});
