import { describe, expect, it } from "vitest";
import type { ResolvedProfile } from "../inheritance/profile-chain.js";
import type { ProfileManifest } from "../schemas/profile-manifest.js";
import {
  WEIGHT_LOCK,
  getProfileWeight,
  isLockedProfile,
  sortProfilesByWeight,
} from "./weight-sort.js";

function makeProfile(name: string, weight?: number): ResolvedProfile {
  return {
    name,
    source: `github:org/${name}`,
    manifest: {
      name,
      version: "1.0.0",
      ...(weight !== undefined ? { weight } : {}),
    } as ProfileManifest,
  };
}

describe("getProfileWeight", () => {
  it("returns 0 for profiles without weight", () => {
    const profile = makeProfile("no-weight");
    expect(getProfileWeight(profile)).toBe(0);
  });

  it("returns the weight when set", () => {
    const profile = makeProfile("weighted", 5);
    expect(getProfileWeight(profile)).toBe(5);
  });

  it("returns -1 for locked profiles", () => {
    const profile = makeProfile("locked", -1);
    expect(getProfileWeight(profile)).toBe(-1);
  });

  it("returns 0 when weight is explicitly 0", () => {
    const profile = makeProfile("default", 0);
    expect(getProfileWeight(profile)).toBe(0);
  });
});

describe("sortProfilesByWeight", () => {
  it("returns empty array for empty input", () => {
    expect(sortProfilesByWeight([])).toEqual([]);
  });

  it("returns single profile unchanged", () => {
    const profiles = [makeProfile("solo", 5)];
    const sorted = sortProfilesByWeight(profiles);
    expect(sorted).toHaveLength(1);
    expect(sorted[0].name).toBe("solo");
  });

  it("sorts profiles ascending by weight (higher weight last)", () => {
    const profiles = [makeProfile("high", 10), makeProfile("low", 1), makeProfile("mid", 5)];

    const sorted = sortProfilesByWeight(profiles);

    expect(sorted.map((p) => p.name)).toEqual(["low", "mid", "high"]);
  });

  it("preserves order for same-weight profiles (stable sort)", () => {
    const profiles = [makeProfile("first", 0), makeProfile("second", 0), makeProfile("third", 0)];

    const sorted = sortProfilesByWeight(profiles);

    expect(sorted.map((p) => p.name)).toEqual(["first", "second", "third"]);
  });

  it("treats undefined weight as 0", () => {
    const profiles = [makeProfile("explicit-zero", 0), makeProfile("no-weight")];

    const sorted = sortProfilesByWeight(profiles);

    // Both have effective weight 0, so order is preserved
    expect(sorted.map((p) => p.name)).toEqual(["explicit-zero", "no-weight"]);
  });

  it("places locked profiles (weight -1) before default profiles", () => {
    const locked = makeProfile("locked", -1);
    const normal = makeProfile("normal", 0);
    const high = makeProfile("high", 5);

    const sorted = sortProfilesByWeight([normal, locked, high]);

    expect(sorted.map((p) => p.name)).toEqual(["locked", "normal", "high"]);
  });

  it("does not mutate the original array", () => {
    const profiles = [makeProfile("high", 10), makeProfile("low", 1)];
    const original = [...profiles];

    sortProfilesByWeight(profiles);

    expect(profiles.map((p) => p.name)).toEqual(original.map((p) => p.name));
  });

  it("handles mixed weights with stable sort for same-weight groups", () => {
    const profiles = [
      makeProfile("alpha", 5),
      makeProfile("beta", 0),
      makeProfile("gamma", 5),
      makeProfile("delta", 0),
      makeProfile("epsilon", 10),
    ];

    const sorted = sortProfilesByWeight(profiles);

    // Weight 0: beta, delta (preserved order)
    // Weight 5: alpha, gamma (preserved order)
    // Weight 10: epsilon
    expect(sorted.map((p) => p.name)).toEqual(["beta", "delta", "alpha", "gamma", "epsilon"]);
  });
});

describe("isLockedProfile", () => {
  it("returns true for weight -1", () => {
    expect(isLockedProfile(makeProfile("locked", -1))).toBe(true);
  });

  it("returns false for weight 0", () => {
    expect(isLockedProfile(makeProfile("normal", 0))).toBe(false);
  });

  it("returns false for positive weight", () => {
    expect(isLockedProfile(makeProfile("high", 10))).toBe(false);
  });

  it("returns false for undefined weight", () => {
    expect(isLockedProfile(makeProfile("no-weight"))).toBe(false);
  });
});

describe("WEIGHT_LOCK", () => {
  it("equals -1", () => {
    expect(WEIGHT_LOCK).toBe(-1);
  });
});
