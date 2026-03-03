import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("node:fs/promises", async (importOriginal) => ({
    ...(await importOriginal<typeof import("node:fs/promises")>()),
    readFile: vi.fn(),
}));

const mockedReadFile = readFile as Mock;

// Import after mocking
const { loadProfileManifestSafe } = await import("./load-profile-safe.js");

describe("loadProfileManifestSafe", () => {
    const sourceRoot = "/fake/source";
    const profilePath = "profiles/frontend";
    const manifestPath = join(sourceRoot, profilePath, "baton.profile.yaml");

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns parsed manifest for valid profile", async () => {
        mockedReadFile.mockResolvedValue(
            "name: frontend\nversion: 1.0.0\ndescription: Frontend profile\n",
        );

        const result = await loadProfileManifestSafe(sourceRoot, profilePath);

        expect(result).toEqual({
            name: "frontend",
            version: "1.0.0",
            description: "Frontend profile",
        });
        expect(console.warn).not.toHaveBeenCalled();
    });

    it("returns parsed manifest for profile with extends, skills, agents, commands", async () => {
        const yaml = [
            "name: extended-profile",
            "version: 2.0.0",
            "extends: base",
            "ai:",
            "  skills:",
            "    - name: my-skill",
            "      scope: project",
            "  agents:",
            "    - my-agent",
            "  commands:",
            "    - my-command",
        ].join("\n");

        mockedReadFile.mockResolvedValue(yaml);

        const result = await loadProfileManifestSafe(sourceRoot, profilePath);

        expect(result).toEqual({
            name: "extended-profile",
            version: "2.0.0",
            description: undefined,
            extends: "base",
            weight: undefined,
        });
        expect(console.warn).not.toHaveBeenCalled();
    });

    it("returns null silently for ENOENT (file not found)", async () => {
        const error = new Error("ENOENT: no such file or directory") as NodeJS.ErrnoException;
        error.code = "ENOENT";
        mockedReadFile.mockRejectedValue(error);

        const result = await loadProfileManifestSafe(sourceRoot, profilePath);

        expect(result).toBeNull();
        expect(console.warn).not.toHaveBeenCalled();
    });

    it("returns null silently for error message containing ENOENT", async () => {
        const error = new Error("ENOENT: no such file or directory, open '/fake/path'");
        mockedReadFile.mockRejectedValue(error);

        const result = await loadProfileManifestSafe(sourceRoot, profilePath);

        expect(result).toBeNull();
        expect(console.warn).not.toHaveBeenCalled();
    });

    it("returns null with warning for Zod validation errors", async () => {
        // Invalid: name is not kebab-case, version is not semver
        mockedReadFile.mockResolvedValue("name: INVALID NAME\nversion: not-semver\n");

        const result = await loadProfileManifestSafe(sourceRoot, profilePath);

        expect(result).toBeNull();
        expect(console.warn).toHaveBeenCalledOnce();
        const warning = (console.warn as Mock).mock.calls[0][0] as string;
        expect(warning).toContain("Invalid profile manifest");
        expect(warning).toContain(manifestPath);
    });

    it("includes specific validation issues in Zod warning", async () => {
        mockedReadFile.mockResolvedValue("name: INVALID\nversion: bad\n");

        await loadProfileManifestSafe(sourceRoot, profilePath);

        const warning = (console.warn as Mock).mock.calls[0][0] as string;
        expect(warning).toContain("name:");
        expect(warning).toContain("version:");
    });

    it("returns null with warning for YAML parse errors", async () => {
        // Unterminated flow sequence is genuinely invalid YAML
        mockedReadFile.mockResolvedValue("name: [unterminated");

        const result = await loadProfileManifestSafe(sourceRoot, profilePath);

        expect(result).toBeNull();
        expect(console.warn).toHaveBeenCalledOnce();
        const warning = (console.warn as Mock).mock.calls[0][0] as string;
        expect(warning).toContain("Could not load profile manifest");
        expect(warning).toContain(manifestPath);
    });

    it("returns null with warning for other errors", async () => {
        const error = new Error("Permission denied");
        mockedReadFile.mockRejectedValue(error);

        const result = await loadProfileManifestSafe(sourceRoot, profilePath);

        expect(result).toBeNull();
        expect(console.warn).toHaveBeenCalledOnce();
        const warning = (console.warn as Mock).mock.calls[0][0] as string;
        expect(warning).toContain("Could not load profile manifest");
        expect(warning).toContain("Permission denied");
        expect(warning).toContain(manifestPath);
    });
});
