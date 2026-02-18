import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  discoverProfilesInSourceRepo,
  findSourceManifest,
  isSourceRepository,
} from "./source-discovery.js";

describe("source-discovery", () => {
  const testDir = join(process.cwd(), "tmp", "source-discovery-test");

  beforeEach(async () => {
    // Create test directory
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  describe("isSourceRepository", () => {
    it("returns true when baton.source.yaml exists", async () => {
      // Create source manifest
      await writeFile(
        join(testDir, "baton.source.yaml"),
        `name: "test-source"
version: "1.0.0"
`,
      );

      const result = await isSourceRepository(testDir);
      expect(result).toBe(true);
    });

    it("returns false when baton.source.yaml does not exist", async () => {
      const result = await isSourceRepository(testDir);
      expect(result).toBe(false);
    });

    it("returns false when directory contains baton.profile.yaml but not baton.source.yaml", async () => {
      // Create profile manifest (old format)
      await writeFile(
        join(testDir, "baton.profile.yaml"),
        `name: "test-profile"
version: "1.0.0"
`,
      );

      const result = await isSourceRepository(testDir);
      expect(result).toBe(false);
    });
  });

  describe("findSourceManifest", () => {
    it("loads and validates source manifest", async () => {
      await writeFile(
        join(testDir, "baton.source.yaml"),
        `name: "my-configs"
version: "1.2.3"
description: "Team configuration repository"
repository: "https://github.com/org/my-configs"

profiles:
  - name: "default"
    path: "profiles/default"
    description: "Default profile"
  - name: "frontend"
    path: "profiles/frontend"

metadata:
  created: "2024"
  team: "engineering"
`,
      );

      const manifest = await findSourceManifest(testDir);

      expect(manifest).toEqual({
        name: "my-configs",
        version: "1.2.3",
        description: "Team configuration repository",
        repository: "https://github.com/org/my-configs",
        profiles: [
          {
            name: "default",
            path: "profiles/default",
            description: "Default profile",
          },
          {
            name: "frontend",
            path: "profiles/frontend",
          },
        ],
        metadata: {
          created: "2024",
          team: "engineering",
        },
      });
    });

    it("loads minimal source manifest", async () => {
      await writeFile(
        join(testDir, "baton.source.yaml"),
        `name: "simple"
version: "0.1.0"
`,
      );

      const manifest = await findSourceManifest(testDir);

      expect(manifest).toEqual({
        name: "simple",
        version: "0.1.0",
      });
    });

    it("throws error when source manifest does not exist", async () => {
      await expect(findSourceManifest(testDir)).rejects.toThrow("Source manifest not found");
      await expect(findSourceManifest(testDir)).rejects.toThrow(
        "This directory is not a Baton source repository",
      );
    });

    it("throws error for invalid semver version", async () => {
      await writeFile(
        join(testDir, "baton.source.yaml"),
        `name: "invalid"
version: "not-a-version"
`,
      );

      await expect(findSourceManifest(testDir)).rejects.toThrow("Invalid source manifest");
    });

    it("throws error for malformed YAML", async () => {
      await writeFile(
        join(testDir, "baton.source.yaml"),
        `name: "broken
version: 1.0.0
this is not valid: [unclosed
`,
      );

      await expect(findSourceManifest(testDir)).rejects.toThrow("Invalid source manifest");
    });
  });

  describe("discoverProfilesInSourceRepo", () => {
    it("discovers profiles in profiles/ directory", async () => {
      // Create source manifest
      await writeFile(
        join(testDir, "baton.source.yaml"),
        `name: "test-source"
version: "1.0.0"
`,
      );

      // Create profiles directory with profiles
      await mkdir(join(testDir, "profiles", "default"), { recursive: true });
      await writeFile(
        join(testDir, "profiles", "default", "baton.profile.yaml"),
        `name: "default"
version: "1.0.0"
description: "Default profile"
`,
      );

      await mkdir(join(testDir, "profiles", "frontend"), { recursive: true });
      await writeFile(
        join(testDir, "profiles", "frontend", "baton.profile.yaml"),
        `name: "frontend"
version: "1.2.0"
`,
      );

      const profiles = await discoverProfilesInSourceRepo(testDir);

      expect(profiles).toHaveLength(2);

      // Sort by name for predictable testing
      const sorted = profiles.sort((a, b) => a.name.localeCompare(b.name));
      expect(sorted[0]).toEqual({
        name: "default",
        path: "profiles/default",
        version: "1.0.0",
        description: "Default profile",
      });
      expect(sorted[1]).toEqual({
        name: "frontend",
        path: "profiles/frontend",
        version: "1.2.0",
      });
    });

    it("returns empty array when profiles/ directory does not exist", async () => {
      // Source manifest but no profiles/ directory
      await writeFile(
        join(testDir, "baton.source.yaml"),
        `name: "empty-source"
version: "1.0.0"
`,
      );

      const profiles = await discoverProfilesInSourceRepo(testDir);
      expect(profiles).toEqual([]);
    });

    it("returns empty array when profiles/ directory is empty", async () => {
      await writeFile(
        join(testDir, "baton.source.yaml"),
        `name: "empty-profiles"
version: "1.0.0"
`,
      );

      // Create empty profiles directory
      await mkdir(join(testDir, "profiles"));

      const profiles = await discoverProfilesInSourceRepo(testDir);
      expect(profiles).toEqual([]);
    });

    it("ignores directories without baton.profile.yaml", async () => {
      await mkdir(join(testDir, "profiles", "default"), { recursive: true });
      await writeFile(
        join(testDir, "profiles", "default", "baton.profile.yaml"),
        `name: "default"
version: "1.0.0"
`,
      );

      // Create directory without manifest
      await mkdir(join(testDir, "profiles", "incomplete"));
      await writeFile(join(testDir, "profiles", "incomplete", "README.md"), "");

      const profiles = await discoverProfilesInSourceRepo(testDir);

      expect(profiles).toHaveLength(1);
      expect(profiles[0].name).toBe("default");
    });

    it("ignores hidden directories in profiles/", async () => {
      await mkdir(join(testDir, "profiles", "default"), { recursive: true });
      await writeFile(
        join(testDir, "profiles", "default", "baton.profile.yaml"),
        `name: "default"
version: "1.0.0"
`,
      );

      // Create hidden directory with profile (should be ignored)
      await mkdir(join(testDir, "profiles", ".hidden"), { recursive: true });
      await writeFile(
        join(testDir, "profiles", ".hidden", "baton.profile.yaml"),
        `name: "hidden"
version: "1.0.0"
`,
      );

      const profiles = await discoverProfilesInSourceRepo(testDir);

      expect(profiles).toHaveLength(1);
      expect(profiles[0].name).toBe("default");
    });

    it("ignores node_modules in profiles/", async () => {
      await mkdir(join(testDir, "profiles", "default"), { recursive: true });
      await writeFile(
        join(testDir, "profiles", "default", "baton.profile.yaml"),
        `name: "default"
version: "1.0.0"
`,
      );

      // Create node_modules with profile (should be ignored)
      await mkdir(join(testDir, "profiles", "node_modules"), { recursive: true });
      await writeFile(
        join(testDir, "profiles", "node_modules", "baton.profile.yaml"),
        `name: "should-ignore"
version: "1.0.0"
`,
      );

      const profiles = await discoverProfilesInSourceRepo(testDir);

      expect(profiles).toHaveLength(1);
      expect(profiles[0].name).toBe("default");
    });

    it("ignores invalid profile manifests", async () => {
      await mkdir(join(testDir, "profiles", "valid"), { recursive: true });
      await writeFile(
        join(testDir, "profiles", "valid", "baton.profile.yaml"),
        `name: "valid"
version: "1.0.0"
`,
      );

      // Create profile with invalid manifest (missing version)
      await mkdir(join(testDir, "profiles", "invalid"), { recursive: true });
      await writeFile(
        join(testDir, "profiles", "invalid", "baton.profile.yaml"),
        `name: "invalid"
# missing version
`,
      );

      const profiles = await discoverProfilesInSourceRepo(testDir);

      // Should only return valid profile
      expect(profiles).toHaveLength(1);
      expect(profiles[0].name).toBe("valid");
    });

    it("ignores files in profiles/ directory", async () => {
      await mkdir(join(testDir, "profiles", "default"), { recursive: true });
      await writeFile(
        join(testDir, "profiles", "default", "baton.profile.yaml"),
        `name: "default"
version: "1.0.0"
`,
      );

      // Create files in profiles/ (should be ignored)
      await writeFile(join(testDir, "profiles", "README.md"), "# Profiles");
      await writeFile(join(testDir, "profiles", ".gitkeep"), "");

      const profiles = await discoverProfilesInSourceRepo(testDir);

      expect(profiles).toHaveLength(1);
      expect(profiles[0].name).toBe("default");
    });

    it("does not scan nested directories deeper than one level", async () => {
      await mkdir(join(testDir, "profiles", "team"), { recursive: true });
      await writeFile(
        join(testDir, "profiles", "team", "baton.profile.yaml"),
        `name: "team"
version: "1.0.0"
`,
      );

      // Create nested profile (2 levels deep - should be ignored)
      await mkdir(join(testDir, "profiles", "team", "frontend"), {
        recursive: true,
      });
      await writeFile(
        join(testDir, "profiles", "team", "frontend", "baton.profile.yaml"),
        `name: "nested"
version: "1.0.0"
`,
      );

      const profiles = await discoverProfilesInSourceRepo(testDir);

      // Should only find team, not the nested profile
      expect(profiles).toHaveLength(1);
      expect(profiles[0].name).toBe("team");
    });
  });
});
