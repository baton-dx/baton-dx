import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkLatestVersion, isUpdateAvailable } from "./check-latest-version.js";

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("isUpdateAvailable", () => {
    it("returns true when latest is newer", () => {
        const result = isUpdateAvailable("0.5.0", "0.6.0");
        expect(result).toEqual({
            currentVersion: "0.5.0",
            latestVersion: "0.6.0",
            updateAvailable: true,
        });
    });

    it("returns false when versions are equal", () => {
        const result = isUpdateAvailable("0.5.0", "0.5.0");
        expect(result).toEqual({
            currentVersion: "0.5.0",
            latestVersion: "0.5.0",
            updateAvailable: false,
        });
    });

    it("returns false when current is newer", () => {
        const result = isUpdateAvailable("1.0.0", "0.9.0");
        expect(result).toEqual({
            currentVersion: "1.0.0",
            latestVersion: "0.9.0",
            updateAvailable: false,
        });
    });

    it("handles prerelease versions", () => {
        const result = isUpdateAvailable("0.5.0-beta.1", "0.5.0");
        expect(result.updateAvailable).toBe(true);
    });

    it("handles major version bumps", () => {
        const result = isUpdateAvailable("0.99.99", "1.0.0");
        expect(result.updateAvailable).toBe(true);
    });
});

describe("checkLatestVersion", () => {
    it("fetches and parses the latest version from npm registry", async () => {
        const mockResponse = {
            ok: true,
            json: async () => ({ version: "1.2.3", description: "Test package" }),
        };
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

        const result = await checkLatestVersion();
        expect(result).toEqual({ version: "1.2.3", description: "Test package" });

        vi.unstubAllGlobals();
    });

    it("throws on non-ok response", async () => {
        const mockResponse = { ok: false, status: 404 };
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

        await expect(checkLatestVersion()).rejects.toThrow("npm registry returned 404");

        vi.unstubAllGlobals();
    });

    it("throws when response has no version field", async () => {
        const mockResponse = {
            ok: true,
            json: async () => ({ name: "@baton-dx/cli" }),
        };
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

        await expect(checkLatestVersion()).rejects.toThrow("Failed to parse version");

        vi.unstubAllGlobals();
    });

    it("throws when version is not a string", async () => {
        const mockResponse = {
            ok: true,
            json: async () => ({ version: 123 }),
        };
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

        await expect(checkLatestVersion()).rejects.toThrow("Failed to parse version");

        vi.unstubAllGlobals();
    });

    it("handles missing description gracefully", async () => {
        const mockResponse = {
            ok: true,
            json: async () => ({ version: "2.0.0" }),
        };
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

        const result = await checkLatestVersion();
        expect(result).toEqual({ version: "2.0.0", description: undefined });

        vi.unstubAllGlobals();
    });
});
