import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discoverProfiles } from "./profile-discovery.js";

describe("discoverProfiles", () => {
    const testDir = join(process.cwd(), "tmp", "profile-discovery-test");

    beforeEach(async () => {
        // Create test directory
        await mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
        // Clean up test directory
        await rm(testDir, { recursive: true, force: true });
    });

    it("discovers root profile only", async () => {
        // Create root manifest
        await writeFile(
            join(testDir, "baton.profile.yaml"),
            `name: "test-root"
version: "1.0.0"
description: "Root profile for testing"
`,
        );

        const profiles = await discoverProfiles(testDir);

        expect(profiles).toHaveLength(1);
        expect(profiles[0]).toEqual({
            name: "test-root",
            path: ".",
            version: "1.0.0",
            description: "Root profile for testing",
        });
    });

    it("discovers root profile without description", async () => {
        // Create root manifest without description
        await writeFile(
            join(testDir, "baton.profile.yaml"),
            `name: "minimal"
version: "2.3.1"
`,
        );

        const profiles = await discoverProfiles(testDir);

        expect(profiles).toHaveLength(1);
        expect(profiles[0]).toEqual({
            name: "minimal",
            path: ".",
            version: "2.3.1",
            description: undefined,
        });
    });

    it("discovers root and one sub-profile", async () => {
        // Create root manifest
        await writeFile(
            join(testDir, "baton.profile.yaml"),
            `name: "enterprise"
version: "1.0.0"
description: "Enterprise base profile"
`,
        );

        // Create sub-profile directory
        await mkdir(join(testDir, "frontend"));
        await writeFile(
            join(testDir, "frontend", "baton.profile.yaml"),
            `name: "enterprise-frontend"
version: "1.0.0"
description: "Frontend team profile"
`,
        );

        const profiles = await discoverProfiles(testDir);

        expect(profiles).toHaveLength(2);
        expect(profiles[0]).toEqual({
            name: "enterprise",
            path: ".",
            version: "1.0.0",
            description: "Enterprise base profile",
        });
        expect(profiles[1]).toEqual({
            name: "enterprise-frontend",
            path: "frontend",
            version: "1.0.0",
            description: "Frontend team profile",
        });
    });

    it("discovers multiple sub-profiles", async () => {
        // Create root manifest
        await writeFile(
            join(testDir, "baton.profile.yaml"),
            `name: "company"
version: "2.0.0"
`,
        );

        // Create multiple sub-profiles
        await mkdir(join(testDir, "frontend"));
        await writeFile(
            join(testDir, "frontend", "baton.profile.yaml"),
            `name: "company-frontend"
version: "2.0.0"
`,
        );

        await mkdir(join(testDir, "backend"));
        await writeFile(
            join(testDir, "backend", "baton.profile.yaml"),
            `name: "company-backend"
version: "2.0.0"
description: "Backend API configuration"
`,
        );

        await mkdir(join(testDir, "mobile"));
        await writeFile(
            join(testDir, "mobile", "baton.profile.yaml"),
            `name: "company-mobile"
version: "2.1.0"
`,
        );

        const profiles = await discoverProfiles(testDir);

        expect(profiles).toHaveLength(4);
        // Profile order depends on file system readdir order
        const names = profiles.map((p) => p.name).sort();
        expect(names).toEqual(["company", "company-backend", "company-frontend", "company-mobile"]);
    });

    it("returns empty array when no profiles found", async () => {
        const profiles = await discoverProfiles(testDir);
        expect(profiles).toEqual([]);
    });

    it("ignores directories without baton.profile.yaml", async () => {
        // Create root profile
        await writeFile(
            join(testDir, "baton.profile.yaml"),
            `name: "root"
version: "1.0.0"
`,
        );

        // Create directories without manifests
        await mkdir(join(testDir, "docs"));
        await mkdir(join(testDir, "scripts"));
        await mkdir(join(testDir, "utils"));

        const profiles = await discoverProfiles(testDir);

        expect(profiles).toHaveLength(1);
        expect(profiles[0].name).toBe("root");
    });

    it("ignores hidden directories", async () => {
        // Create root profile
        await writeFile(
            join(testDir, "baton.profile.yaml"),
            `name: "root"
version: "1.0.0"
`,
        );

        // Create hidden directory with manifest (should be ignored)
        await mkdir(join(testDir, ".hidden"));
        await writeFile(
            join(testDir, ".hidden", "baton.profile.yaml"),
            `name: "hidden"
version: "1.0.0"
`,
        );

        const profiles = await discoverProfiles(testDir);

        expect(profiles).toHaveLength(1);
        expect(profiles[0].name).toBe("root");
    });

    it("ignores node_modules directory", async () => {
        // Create root profile
        await writeFile(
            join(testDir, "baton.profile.yaml"),
            `name: "root"
version: "1.0.0"
`,
        );

        // Create node_modules with manifest (should be ignored)
        await mkdir(join(testDir, "node_modules"));
        await writeFile(
            join(testDir, "node_modules", "baton.profile.yaml"),
            `name: "should-be-ignored"
version: "1.0.0"
`,
        );

        const profiles = await discoverProfiles(testDir);

        expect(profiles).toHaveLength(1);
        expect(profiles[0].name).toBe("root");
    });

    it("ignores invalid manifest files", async () => {
        // Create root profile
        await writeFile(
            join(testDir, "baton.profile.yaml"),
            `name: "root"
version: "1.0.0"
`,
        );

        // Create sub-profile with invalid manifest (missing version)
        await mkdir(join(testDir, "invalid"));
        await writeFile(
            join(testDir, "invalid", "baton.profile.yaml"),
            `name: "invalid-profile"
# missing version field
`,
        );

        const profiles = await discoverProfiles(testDir);

        // Should only return root, invalid profile is skipped
        expect(profiles).toHaveLength(1);
        expect(profiles[0].name).toBe("root");
    });

    it("ignores sub-profiles with malformed YAML", async () => {
        // Create root profile
        await writeFile(
            join(testDir, "baton.profile.yaml"),
            `name: "root"
version: "1.0.0"
`,
        );

        // Create sub-profile with malformed YAML
        await mkdir(join(testDir, "broken"));
        await writeFile(
            join(testDir, "broken", "baton.profile.yaml"),
            `name: "broken
version: 1.0.0
this is not valid YAML: [unclosed
`,
        );

        const profiles = await discoverProfiles(testDir);

        // Should only return root
        expect(profiles).toHaveLength(1);
        expect(profiles[0].name).toBe("root");
    });

    it("does not scan nested directories deeper than one level", async () => {
        // Create root profile
        await writeFile(
            join(testDir, "baton.profile.yaml"),
            `name: "root"
version: "1.0.0"
`,
        );

        // Create nested directory structure (2 levels deep)
        await mkdir(join(testDir, "team", "frontend"), { recursive: true });
        await writeFile(
            join(testDir, "team", "frontend", "baton.profile.yaml"),
            `name: "nested-profile"
version: "1.0.0"
`,
        );

        const profiles = await discoverProfiles(testDir);

        // Should only discover root, not the nested profile
        expect(profiles).toHaveLength(1);
        expect(profiles[0].name).toBe("root");
    });

    it("handles files in root directory (not just directories)", async () => {
        // Create root profile
        await writeFile(
            join(testDir, "baton.profile.yaml"),
            `name: "root"
version: "1.0.0"
`,
        );

        // Create some regular files in root
        await writeFile(join(testDir, "README.md"), "# Readme");
        await writeFile(join(testDir, "package.json"), "{}");

        const profiles = await discoverProfiles(testDir);

        // Should only find root profile, files should be ignored
        expect(profiles).toHaveLength(1);
        expect(profiles[0].name).toBe("root");
    });
});
