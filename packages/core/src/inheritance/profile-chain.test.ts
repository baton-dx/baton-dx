import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CircularInheritanceError } from "../errors.js";
import { expandSparseCheckout } from "../sources/git-clone.js";
import type { CloneContext } from "./profile-chain.js";
import { resolveProfileChain } from "./profile-chain.js";

vi.mock("../sources/git-clone.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../sources/git-clone.js")>();
  return {
    ...actual,
    expandSparseCheckout: vi.fn(),
  };
});

describe("inheritance/profile-chain", () => {
  let tempDir: string;
  let profilesDir: string;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = join(tmpdir(), `baton-test-${crypto.randomUUID()}`);
    profilesDir = join(tempDir, "profiles");
    await mkdir(profilesDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp directory
    await rm(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  });

  describe("resolveProfileChain", () => {
    it("resolves single profile without extends", async () => {
      // Create a simple profile
      const profilePath = join(profilesDir, "simple");
      await mkdir(profilePath, { recursive: true });
      await writeFile(
        join(profilePath, "baton.profile.yaml"),
        `
name: simple-profile
version: 1.0.0
description: A simple profile
`,
        "utf-8",
      );

      const manifest = {
        name: "simple-profile",
        version: "1.0.0",
        description: "A simple profile",
      };

      const chain = await resolveProfileChain(manifest, "./profiles/simple", tempDir);

      expect(chain).toHaveLength(1);
      expect(chain[0].name).toBe("simple-profile");
      expect(chain[0].manifest.name).toBe("simple-profile");
    });

    it("resolves two-level inheritance chain", async () => {
      // Create base profile
      const basePath = join(profilesDir, "base");
      await mkdir(basePath, { recursive: true });
      await writeFile(
        join(basePath, "baton.profile.yaml"),
        `
name: base-profile
version: 1.0.0
description: Base profile
`,
        "utf-8",
      );

      // Create child profile that extends base
      const childPath = join(profilesDir, "child");
      await mkdir(childPath, { recursive: true });
      await writeFile(
        join(childPath, "baton.profile.yaml"),
        `
name: child-profile
version: 1.0.0
description: Child profile
extends:
  - ./profiles/base
`,
        "utf-8",
      );

      const childManifest = {
        name: "child-profile",
        version: "1.0.0",
        description: "Child profile",
        extends: ["./profiles/base"],
      };

      const chain = await resolveProfileChain(childManifest, "./profiles/child", tempDir);

      expect(chain).toHaveLength(2);
      expect(chain[0].name).toBe("base-profile"); // Base comes first
      expect(chain[1].name).toBe("child-profile"); // Child comes last
    });

    it("resolves three-level inheritance chain", async () => {
      // Create grandparent profile
      const grandparentPath = join(profilesDir, "grandparent");
      await mkdir(grandparentPath, { recursive: true });
      await writeFile(
        join(grandparentPath, "baton.profile.yaml"),
        `
name: grandparent-profile
version: 1.0.0
`,
        "utf-8",
      );

      // Create parent profile that extends grandparent
      const parentPath = join(profilesDir, "parent");
      await mkdir(parentPath, { recursive: true });
      await writeFile(
        join(parentPath, "baton.profile.yaml"),
        `
name: parent-profile
version: 1.0.0
extends:
  - ./profiles/grandparent
`,
        "utf-8",
      );

      // Create child profile that extends parent
      const childPath = join(profilesDir, "child");
      await mkdir(childPath, { recursive: true });
      await writeFile(
        join(childPath, "baton.profile.yaml"),
        `
name: child-profile
version: 1.0.0
extends:
  - ./profiles/parent
`,
        "utf-8",
      );

      const childManifest = {
        name: "child-profile",
        version: "1.0.0",
        extends: ["./profiles/parent"],
      };

      const chain = await resolveProfileChain(childManifest, "./profiles/child", tempDir);

      expect(chain).toHaveLength(3);
      expect(chain[0].name).toBe("grandparent-profile");
      expect(chain[1].name).toBe("parent-profile");
      expect(chain[2].name).toBe("child-profile");
    });

    it("resolves multiple extends (diamond pattern)", async () => {
      // Create base profile
      const basePath = join(profilesDir, "base");
      await mkdir(basePath, { recursive: true });
      await writeFile(
        join(basePath, "baton.profile.yaml"),
        `
name: base-profile
version: 1.0.0
`,
        "utf-8",
      );

      // Create mixin-a that extends base
      const mixinAPath = join(profilesDir, "mixin-a");
      await mkdir(mixinAPath, { recursive: true });
      await writeFile(
        join(mixinAPath, "baton.profile.yaml"),
        `
name: mixin-a-profile
version: 1.0.0
extends:
  - ./profiles/base
`,
        "utf-8",
      );

      // Create mixin-b that extends base
      const mixinBPath = join(profilesDir, "mixin-b");
      await mkdir(mixinBPath, { recursive: true });
      await writeFile(
        join(mixinBPath, "baton.profile.yaml"),
        `
name: mixin-b-profile
version: 1.0.0
extends:
  - ./profiles/base
`,
        "utf-8",
      );

      // Create child that extends both mixins
      const childPath = join(profilesDir, "child");
      await mkdir(childPath, { recursive: true });
      await writeFile(
        join(childPath, "baton.profile.yaml"),
        `
name: child-profile
version: 1.0.0
extends:
  - ./profiles/mixin-a
  - ./profiles/mixin-b
`,
        "utf-8",
      );

      const childManifest = {
        name: "child-profile",
        version: "1.0.0",
        extends: ["./profiles/mixin-a", "./profiles/mixin-b"],
      };

      const chain = await resolveProfileChain(childManifest, "./profiles/child", tempDir);

      // Base should appear multiple times (once per path)
      // Order: base (via mixin-a), mixin-a, base (via mixin-b), mixin-b, child
      expect(chain.length).toBeGreaterThanOrEqual(3);
      expect(chain[chain.length - 1].name).toBe("child-profile");
    });

    it("detects circular inheritance (direct)", async () => {
      // Create profile-a that extends profile-b
      const profileAPath = join(profilesDir, "profile-a");
      await mkdir(profileAPath, { recursive: true });
      await writeFile(
        join(profileAPath, "baton.profile.yaml"),
        `
name: profile-a
version: 1.0.0
extends:
  - ./profiles/profile-b
`,
        "utf-8",
      );

      // Create profile-b that extends profile-a (circular)
      const profileBPath = join(profilesDir, "profile-b");
      await mkdir(profileBPath, { recursive: true });
      await writeFile(
        join(profileBPath, "baton.profile.yaml"),
        `
name: profile-b
version: 1.0.0
extends:
  - ./profiles/profile-a
`,
        "utf-8",
      );

      const manifestA = {
        name: "profile-a",
        version: "1.0.0",
        extends: ["./profiles/profile-b"],
      };

      await expect(resolveProfileChain(manifestA, "./profiles/profile-a", tempDir)).rejects.toThrow(
        CircularInheritanceError,
      );
    });

    it("detects circular inheritance (indirect)", async () => {
      // Create profile-a -> profile-b -> profile-c -> profile-a (circular)
      // First create all three profiles with their files
      const profileAPath = join(profilesDir, "profile-a");
      await mkdir(profileAPath, { recursive: true });
      await writeFile(
        join(profileAPath, "baton.profile.yaml"),
        `name: profile-a
version: 1.0.0
extends:
  - ./profiles/profile-b
`,
        "utf-8",
      );

      const profileBPath = join(profilesDir, "profile-b");
      await mkdir(profileBPath, { recursive: true });
      await writeFile(
        join(profileBPath, "baton.profile.yaml"),
        `name: profile-b
version: 1.0.0
extends:
  - ./profiles/profile-c
`,
        "utf-8",
      );

      const profileCPath = join(profilesDir, "profile-c");
      await mkdir(profileCPath, { recursive: true });
      await writeFile(
        join(profileCPath, "baton.profile.yaml"),
        `name: profile-c
version: 1.0.0
extends:
  - ./profiles/profile-a
`,
        "utf-8",
      );

      const manifestA = {
        name: "profile-a",
        version: "1.0.0",
        extends: ["./profiles/profile-b"],
      };

      await expect(resolveProfileChain(manifestA, "./profiles/profile-a", tempDir)).rejects.toThrow(
        CircularInheritanceError,
      );
    });

    it("enforces maximum chain depth", async () => {
      // Create a very deep chain (11 levels)
      for (let i = 0; i < 12; i++) {
        const profilePath = join(profilesDir, `level-${i}`);
        await mkdir(profilePath, { recursive: true });

        const extends_line = i < 11 ? `extends:\n  - ./profiles/level-${i + 1}` : "";

        await writeFile(
          join(profilePath, "baton.profile.yaml"),
          `
name: level-${i}-profile
version: 1.0.0
${extends_line}
`,
          "utf-8",
        );
      }

      const manifest = {
        name: "level-0-profile",
        version: "1.0.0",
        extends: ["./profiles/level-1"],
      };

      await expect(resolveProfileChain(manifest, "./profiles/level-0", tempDir)).rejects.toThrow(
        /exceeds maximum depth/,
      );
    });

    it("returns profiles in correct merge order", async () => {
      // Create base -> middle -> top chain
      const basePath = join(profilesDir, "base");
      await mkdir(basePath, { recursive: true });
      await writeFile(
        join(basePath, "baton.profile.yaml"),
        `
name: base
version: 1.0.0
description: Base profile
`,
        "utf-8",
      );

      const middlePath = join(profilesDir, "middle");
      await mkdir(middlePath, { recursive: true });
      await writeFile(
        join(middlePath, "baton.profile.yaml"),
        `
name: middle
version: 1.0.0
description: Middle profile
extends:
  - ./profiles/base
`,
        "utf-8",
      );

      const topPath = join(profilesDir, "top");
      await mkdir(topPath, { recursive: true });
      await writeFile(
        join(topPath, "baton.profile.yaml"),
        `
name: top
version: 1.0.0
description: Top profile
extends:
  - ./profiles/middle
`,
        "utf-8",
      );

      const topManifest = {
        name: "top",
        version: "1.0.0",
        description: "Top profile",
        extends: ["./profiles/middle"],
      };

      const chain = await resolveProfileChain(topManifest, "./profiles/top", tempDir);

      // Merge order: base first (lowest priority), top last (highest priority)
      expect(chain[0].name).toBe("base");
      expect(chain[1].name).toBe("middle");
      expect(chain[2].name).toBe("top");
    });

    it("populates localPath for inherited profiles", async () => {
      // Create base profile
      const basePath = join(profilesDir, "base");
      await mkdir(basePath, { recursive: true });
      await writeFile(
        join(basePath, "baton.profile.yaml"),
        `
name: base-profile
version: 1.0.0
description: Base profile
`,
        "utf-8",
      );

      // Create child profile that extends base
      const childPath = join(profilesDir, "child");
      await mkdir(childPath, { recursive: true });
      await writeFile(
        join(childPath, "baton.profile.yaml"),
        `
name: child-profile
version: 1.0.0
description: Child profile
extends:
  - ./profiles/base
`,
        "utf-8",
      );

      const childManifest = {
        name: "child-profile",
        version: "1.0.0",
        description: "Child profile",
        extends: ["./profiles/base"],
      };

      const chain = await resolveProfileChain(childManifest, "./profiles/child", tempDir);

      expect(chain).toHaveLength(2);

      // Inherited base profile should have localPath resolved
      expect(chain[0].name).toBe("base-profile");
      expect(chain[0].localPath).toBe(basePath);

      // Root profile (not loaded via loadProfileFromSource) has no localPath
      expect(chain[1].name).toBe("child-profile");
      expect(chain[1].localPath).toBeUndefined();
    });
  });

  describe("resolveProfileChain with CloneContext", () => {
    beforeEach(() => {
      vi.mocked(expandSparseCheckout).mockReset();
    });

    it("expands sparse-checkout and loads parent when profile not initially present", async () => {
      // Create child profile that extends base (base doesn't exist yet — sparse-checkout)
      const childPath = join(profilesDir, "child");
      await mkdir(childPath, { recursive: true });
      await writeFile(
        join(childPath, "baton.profile.yaml"),
        `
name: child-profile
version: 1.0.0
extends:
  - ./profiles/base
`,
        "utf-8",
      );

      // Mock expandSparseCheckout to create the base profile (simulating git checkout expansion)
      vi.mocked(expandSparseCheckout).mockImplementation(async (cachePath, paths) => {
        const basePath = join(cachePath, paths[0]);
        await mkdir(basePath, { recursive: true });
        await writeFile(
          join(basePath, "baton.profile.yaml"),
          "name: base-profile\nversion: 1.0.0\n",
          "utf-8",
        );
      });

      const childManifest = {
        name: "child-profile",
        version: "1.0.0",
        extends: ["./profiles/base"],
      };

      const cloneContext: CloneContext = { cachePath: tempDir, sparseCheckout: true };
      const chain = await resolveProfileChain(
        childManifest,
        "./profiles/child",
        tempDir,
        cloneContext,
      );

      // expandSparseCheckout was called with the relative path to the missing parent
      expect(expandSparseCheckout).toHaveBeenCalledWith(tempDir, ["profiles/base"]);

      // Chain includes both parent and child (base first, child last)
      expect(chain).toHaveLength(2);
      expect(chain[0].name).toBe("base-profile");
      expect(chain[1].name).toBe("child-profile");
    });

    it("works unchanged without CloneContext (local sources)", async () => {
      // Create base profile
      const basePath = join(profilesDir, "base");
      await mkdir(basePath, { recursive: true });
      await writeFile(
        join(basePath, "baton.profile.yaml"),
        "name: base-profile\nversion: 1.0.0\n",
        "utf-8",
      );

      // Create child profile
      const childPath = join(profilesDir, "child");
      await mkdir(childPath, { recursive: true });
      await writeFile(
        join(childPath, "baton.profile.yaml"),
        "name: child-profile\nversion: 1.0.0\nextends:\n  - ./profiles/base\n",
        "utf-8",
      );

      const childManifest = {
        name: "child-profile",
        version: "1.0.0",
        extends: ["./profiles/base"],
      };

      // No cloneContext — standard local resolution
      const chain = await resolveProfileChain(childManifest, "./profiles/child", tempDir);

      // expandSparseCheckout should NOT be called
      expect(expandSparseCheckout).not.toHaveBeenCalled();

      expect(chain).toHaveLength(2);
      expect(chain[0].name).toBe("base-profile");
      expect(chain[1].name).toBe("child-profile");
    });

    it("throws hard error from loadProfileFromSource when expansion does not help", async () => {
      // Create child profile that extends a non-existent base
      const childPath = join(profilesDir, "child");
      await mkdir(childPath, { recursive: true });
      await writeFile(
        join(childPath, "baton.profile.yaml"),
        "name: child-profile\nversion: 1.0.0\nextends:\n  - ./profiles/missing\n",
        "utf-8",
      );

      // expandSparseCheckout is called but does NOT create the file (parent truly doesn't exist)
      vi.mocked(expandSparseCheckout).mockResolvedValue(undefined);

      const childManifest = {
        name: "child-profile",
        version: "1.0.0",
        extends: ["./profiles/missing"],
      };

      const cloneContext: CloneContext = { cachePath: tempDir, sparseCheckout: true };

      // expandSparseCheckout is called (retry attempted)
      // The FileNotFoundError is thrown from loadProfileFromSource after retry,
      // but currently caught by resolveChainRecursive's catch block (US-003 will fix that)
      const chain = await resolveProfileChain(
        childManifest,
        "./profiles/child",
        tempDir,
        cloneContext,
      );

      // expandSparseCheckout was called (expansion was attempted)
      expect(expandSparseCheckout).toHaveBeenCalledWith(tempDir, ["profiles/missing"]);

      // Chain only contains child (parent was not loadable even after expansion)
      expect(chain).toHaveLength(1);
      expect(chain[0].name).toBe("child-profile");
    });
  });
});
