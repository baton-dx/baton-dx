import { describe, expect, it } from "vitest";
import type { LockFile } from "../schemas/lockfile.js";
import { checkLockfileVersion } from "./version-check.js";

function makeLock(batonVersion?: string): LockFile {
    return {
        ...(batonVersion !== undefined ? { baton_version: batonVersion } : {}),
        locked_at: "2026-01-01T00:00:00.000Z",
        packages: {},
    };
}

describe("checkLockfileVersion", () => {
    it("returns null when lockfile has no baton_version", () => {
        expect(checkLockfileVersion(makeLock(), "1.0.0")).toBeNull();
    });

    it("returns null when versions are equal", () => {
        expect(checkLockfileVersion(makeLock("1.2.3"), "1.2.3")).toBeNull();
    });

    it("returns null when installed version is newer than lockfile", () => {
        expect(checkLockfileVersion(makeLock("1.0.0"), "2.0.0")).toBeNull();
    });

    it("returns null when installed version is a newer minor", () => {
        expect(checkLockfileVersion(makeLock("1.2.0"), "1.5.0")).toBeNull();
    });

    it("returns a warning string when lockfile version is newer than installed", () => {
        const result = checkLockfileVersion(makeLock("2.0.0"), "1.9.9");
        expect(result).not.toBeNull();
        expect(result).toContain("2.0.0");
        expect(result).toContain("1.9.9");
    });

    it("returns a warning for a newer minor version in lockfile", () => {
        const result = checkLockfileVersion(makeLock("1.5.0"), "1.2.0");
        expect(result).not.toBeNull();
        expect(result).toContain("1.5.0");
        expect(result).toContain("1.2.0");
    });

    it("returns a warning for a newer patch version in lockfile", () => {
        const result = checkLockfileVersion(makeLock("1.0.1"), "1.0.0");
        expect(result).not.toBeNull();
    });

    it("returns null for non-semver lockfile version (defensive)", () => {
        expect(checkLockfileVersion(makeLock("not-semver"), "1.0.0")).toBeNull();
    });

    it("returns null for non-semver current version (defensive)", () => {
        expect(checkLockfileVersion(makeLock("1.0.0"), "unknown")).toBeNull();
    });
});
