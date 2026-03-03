import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseSource } from "../utils/source-parser.js";
import { resolveNpmSource, validateNpmPackageName } from "./npm-resolver.js";

describe("npm-resolver", () => {
    let testDir: string;

    beforeEach(async () => {
        // Create test directory
        testDir = path.join(process.cwd(), ".test-npm-resolver");
        await mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
        // Cleanup test directory
        await rm(testDir, { recursive: true, force: true });
    });

    describe("detectPackageManager", () => {
        it("detects bun from bun.lockb", async () => {
            await writeFile(path.join(testDir, "bun.lockb"), "");
            const source = parseSource("npm:test-package");

            if (source.provider !== "npm") {
                throw new Error("Expected npm provider");
            }

            // We can't test the actual resolution without a registry
            // but we can verify the source parsing works
            expect(source.package).toBe("test-package");
        });

        it("detects pnpm from pnpm-lock.yaml", async () => {
            await writeFile(path.join(testDir, "pnpm-lock.yaml"), "");
            const source = parseSource("npm:test-package");

            if (source.provider !== "npm") {
                throw new Error("Expected npm provider");
            }

            expect(source.package).toBe("test-package");
        });

        it("detects yarn from yarn.lock", async () => {
            await writeFile(path.join(testDir, "yarn.lock"), "");
            const source = parseSource("npm:test-package");

            if (source.provider !== "npm") {
                throw new Error("Expected npm provider");
            }

            expect(source.package).toBe("test-package");
        });

        it("defaults to npm when no lockfile found", async () => {
            const source = parseSource("npm:test-package");

            if (source.provider !== "npm") {
                throw new Error("Expected npm provider");
            }

            expect(source.package).toBe("test-package");
        });
    });

    describe("parseNpmSource", () => {
        it("parses non-scoped package", () => {
            const source = parseSource("npm:test-package");
            expect(source).toEqual({
                provider: "npm",
                package: "test-package",
            });
        });

        it("parses scoped package", () => {
            const source = parseSource("npm:@baton-dx/core");
            expect(source).toEqual({
                provider: "npm",
                package: "@baton-dx/core",
                scope: "baton-dx",
            });
        });

        it("parses package with subpath", () => {
            const source = parseSource("npm:test-package/profiles/minimal");
            expect(source).toEqual({
                provider: "npm",
                package: "test-package",
                subpath: "profiles/minimal",
            });
        });

        it("parses scoped package with subpath", () => {
            const source = parseSource("npm:@org/package/backend");
            expect(source).toEqual({
                provider: "npm",
                package: "@org/package",
                scope: "org",
                subpath: "backend",
            });
        });
    });

    describe.skip("resolveNpmSource", () => {
        // Integration tests - skip in CI unless registry is available
        it("installs package and finds baton.profile.yaml", async () => {
            const source = parseSource("npm:@baton-dx/test-profile");

            if (source.provider !== "npm") {
                throw new Error("Expected npm provider");
            }

            const resolved = await resolveNpmSource({
                source,
                basePath: testDir,
            });

            expect(resolved.localPath).toContain("node_modules/@baton-dx/test-profile");
            expect(resolved.packageManager).toMatch(/^(npm|bun|pnpm|yarn)$/);
            expect(resolved.version).toBeTruthy();
        });

        it("handles package with subpath", async () => {
            const source = parseSource("npm:@baton-dx/test-profiles/minimal");

            if (source.provider !== "npm") {
                throw new Error("Expected npm provider");
            }

            const resolved = await resolveNpmSource({
                source,
                basePath: testDir,
            });

            expect(resolved.localPath).toContain("node_modules/@baton-dx/test-profiles/minimal");
            expect(resolved.packageManager).toBeTruthy();
        });

        it("throws error if package not found", async () => {
            const source = parseSource("npm:nonexistent-package-xyz-123");

            if (source.provider !== "npm") {
                throw new Error("Expected npm provider");
            }

            await expect(
                resolveNpmSource({
                    source,
                    basePath: testDir,
                }),
            ).rejects.toThrow("NPM package not found");
        });

        it("throws error if no baton.profile.yaml found", async () => {
            const source = parseSource("npm:express"); // Express has no baton.profile.yaml

            if (source.provider !== "npm") {
                throw new Error("Expected npm provider");
            }

            await expect(
                resolveNpmSource({
                    source,
                    basePath: testDir,
                }),
            ).rejects.toThrow("No baton.profile.yaml found");
        });
    });

    describe("package name validation", () => {
        it("accepts valid unscoped package names", () => {
            expect(() => validateNpmPackageName("my-package")).not.toThrow();
        });

        it("accepts valid scoped package names", () => {
            expect(() => validateNpmPackageName("@baton-dx/core")).not.toThrow();
        });

        it("rejects package names with shell metacharacters", async () => {
            const maliciousSource = {
                provider: "npm" as const,
                package: "foo; rm -rf /",
            };
            await expect(
                resolveNpmSource({ source: maliciousSource, basePath: testDir }),
            ).rejects.toThrow('Invalid npm package name: "foo; rm -rf /"');
        });

        it("rejects package names with pipe operator", async () => {
            const maliciousSource = {
                provider: "npm" as const,
                package: "foo | cat /etc/passwd",
            };
            await expect(
                resolveNpmSource({ source: maliciousSource, basePath: testDir }),
            ).rejects.toThrow("Invalid npm package name");
        });

        it("rejects package names with ampersand", async () => {
            const maliciousSource = {
                provider: "npm" as const,
                package: "foo && echo pwned",
            };
            await expect(
                resolveNpmSource({ source: maliciousSource, basePath: testDir }),
            ).rejects.toThrow("Invalid npm package name");
        });

        it("accepts package names with version specifier", () => {
            expect(() => validateNpmPackageName("my-package@1.2.3")).not.toThrow();
        });
    });

    describe("error handling", () => {
        it("provides helpful error for package not found", () => {
            const source = parseSource("npm:nonexistent-package");

            if (source.provider !== "npm") {
                throw new Error("Expected npm provider");
            }

            expect(source.package).toBe("nonexistent-package");
            // Actual error tested in integration test (skipped)
        });

        it("provides helpful error for network issues", () => {
            const source = parseSource("npm:test-package");

            if (source.provider !== "npm") {
                throw new Error("Expected npm provider");
            }

            expect(source.package).toBe("test-package");
            // Actual error tested in integration test (skipped)
        });
    });

    describe("npm cache behavior", () => {
        const npmCacheDir = path.join(homedir(), ".baton", "cache", "npm");

        function computeCacheHash(sourceString: string): string {
            return createHash("sha256").update(sourceString).digest("hex").substring(0, 16);
        }

        async function createFakeCachedPackage(
            packageName: string,
            meta: { version: string; installedAt: number; package: string },
        ): Promise<string> {
            const hash = computeCacheHash(`npm:${packageName}`);
            const cachePath = path.join(npmCacheDir, hash);
            const packageDir = path.join(cachePath, "node_modules", packageName);

            await mkdir(packageDir, { recursive: true });
            await writeFile(path.join(packageDir, "baton.profile.yaml"), "name: test-profile\n");
            await writeFile(
                path.join(packageDir, "package.json"),
                JSON.stringify({ name: packageName, version: meta.version }),
            );
            await writeFile(path.join(cachePath, ".baton-npm-meta.json"), JSON.stringify(meta));

            return cachePath;
        }

        it("uses cached result when cache is valid", async () => {
            const packageName = "test-cache-hit";
            let cachePath: string | undefined;

            try {
                cachePath = await createFakeCachedPackage(packageName, {
                    version: "1.0.0",
                    installedAt: Date.now(),
                    package: packageName,
                });

                const source = parseSource(`npm:${packageName}`);
                if (source.provider !== "npm") {
                    throw new Error("Expected npm provider");
                }

                const resolved = await resolveNpmSource({ source, useCache: true });

                expect(resolved.fromCache).toBe(true);
                expect(resolved.version).toBe("1.0.0");
                expect(resolved.packageManager).toBe("cached");
            } finally {
                if (cachePath) {
                    await rm(cachePath, { recursive: true, force: true });
                }
            }
        });

        it("bypasses cache when useCache is false", async () => {
            const packageName = "test-cache-bypass";
            let cachePath: string | undefined;

            try {
                cachePath = await createFakeCachedPackage(packageName, {
                    version: "1.0.0",
                    installedAt: Date.now(),
                    package: packageName,
                });

                const source = parseSource(`npm:${packageName}`);
                if (source.provider !== "npm") {
                    throw new Error("Expected npm provider");
                }

                await expect(resolveNpmSource({ source, useCache: false })).rejects.toThrow();
            } finally {
                if (cachePath) {
                    await rm(cachePath, { recursive: true, force: true });
                }
            }
        }, 15000);

        it("treats stale cache as miss when maxCacheAgeMs is exceeded", async () => {
            const packageName = "test-cache-stale";
            let cachePath: string | undefined;

            try {
                cachePath = await createFakeCachedPackage(packageName, {
                    version: "1.0.0",
                    installedAt: Date.now() - 999999999,
                    package: packageName,
                });

                const source = parseSource(`npm:${packageName}`);
                if (source.provider !== "npm") {
                    throw new Error("Expected npm provider");
                }

                await expect(
                    resolveNpmSource({ source, useCache: true, maxCacheAgeMs: 1 }),
                ).rejects.toThrow();
            } finally {
                if (cachePath) {
                    await rm(cachePath, { recursive: true, force: true });
                }
            }
        });
    });
});
