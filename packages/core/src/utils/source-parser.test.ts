import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SourceParseError } from "../errors.js";
import { expandLocalPath, parseSource } from "./source-parser.js";

describe("parseSource", () => {
    describe("GitHub sources", () => {
        it("parses github:org/repo", () => {
            const result = parseSource("github:acme/profiles");

            expect(result).toEqual({
                provider: "github",
                org: "acme",
                repo: "profiles",
                url: "https://github.com/acme/profiles.git",
            });
        });

        it("parses github:org/repo with subpath", () => {
            const result = parseSource("github:acme/monorepo/packages/profile");

            expect(result).toEqual({
                provider: "github",
                org: "acme",
                repo: "monorepo",
                subpath: "packages/profile",
                url: "https://github.com/acme/monorepo.git",
            });
        });

        it("parses github:org/repo@v2.0", () => {
            const result = parseSource("github:acme/profiles@v2.0");

            expect(result).toEqual({
                provider: "github",
                org: "acme",
                repo: "profiles",
                ref: "v2.0",
                url: "https://github.com/acme/profiles.git",
            });
        });

        it("parses github:org/repo@main", () => {
            const result = parseSource("github:acme/profiles@main");

            expect(result).toEqual({
                provider: "github",
                org: "acme",
                repo: "profiles",
                ref: "main",
                url: "https://github.com/acme/profiles.git",
            });
        });

        it("parses github:org/repo/subpath@v1.0", () => {
            const result = parseSource("github:acme/monorepo/profiles@v1.0");

            expect(result).toEqual({
                provider: "github",
                org: "acme",
                repo: "monorepo",
                subpath: "profiles",
                ref: "v1.0",
                url: "https://github.com/acme/monorepo.git",
            });
        });
    });

    describe("GitLab sources", () => {
        it("parses gitlab:org/repo", () => {
            const result = parseSource("gitlab:acme/profiles");

            expect(result).toEqual({
                provider: "gitlab",
                org: "acme",
                repo: "profiles",
                url: "https://gitlab.com/acme/profiles.git",
            });
        });

        it("parses gitlab:org/repo with subpath", () => {
            const result = parseSource("gitlab:acme/monorepo/packages/profile");

            expect(result).toEqual({
                provider: "gitlab",
                org: "acme",
                repo: "monorepo",
                subpath: "packages/profile",
                url: "https://gitlab.com/acme/monorepo.git",
            });
        });

        it("parses gitlab:org/repo@v2.0", () => {
            const result = parseSource("gitlab:acme/profiles@v2.0");

            expect(result).toEqual({
                provider: "gitlab",
                org: "acme",
                repo: "profiles",
                ref: "v2.0",
                url: "https://gitlab.com/acme/profiles.git",
            });
        });
    });

    describe("Local sources", () => {
        it("parses ./local/path", () => {
            const result = parseSource("./local/path");

            expect(result).toEqual({
                provider: "local",
                path: "./local/path",
            });
        });

        it("parses ../relative/path", () => {
            const result = parseSource("../relative/path");

            expect(result).toEqual({
                provider: "local",
                path: "../relative/path",
            });
        });

        it("parses /absolute/path", () => {
            const result = parseSource("/absolute/path");

            expect(result).toEqual({
                provider: "local",
                path: "/absolute/path",
            });
        });

        it("parses ~/home/path", () => {
            const result = parseSource("~/Sites/baton/test-v1");

            expect(result).toEqual({
                provider: "local",
                path: "~/Sites/baton/test-v1",
            });
        });

        it("parses ~/ (bare home shorthand)", () => {
            const result = parseSource("~/");

            expect(result).toEqual({
                provider: "local",
                path: "~/",
            });
        });
    });

    describe("Git URL sources", () => {
        it("parses https://git.example.com/repo.git", () => {
            const result = parseSource("https://git.example.com/repo.git");

            expect(result).toEqual({
                provider: "git",
                url: "https://git.example.com/repo.git",
            });
        });

        it("parses git@ SSH URLs", () => {
            const result = parseSource("git@github.com:acme/profiles.git");

            expect(result).toEqual({
                provider: "git",
                url: "git@github.com:acme/profiles.git",
            });
        });
    });

    describe("Error cases", () => {
        it("throws SourceParseError for empty string", () => {
            expect(() => parseSource("")).toThrow(SourceParseError);
            expect(() => parseSource("")).toThrow("Source string cannot be empty");
        });

        it("throws SourceParseError for whitespace-only string", () => {
            expect(() => parseSource("   ")).toThrow(SourceParseError);
            expect(() => parseSource("   ")).toThrow("Source string cannot be empty");
        });

        it("throws SourceParseError for invalid format", () => {
            expect(() => parseSource("invalid-format")).toThrow(SourceParseError);
            expect(() => parseSource("invalid-format")).toThrow(/Invalid source format/);
        });

        it("throws SourceParseError for github: with missing repo", () => {
            expect(() => parseSource("github:org")).toThrow(SourceParseError);
            expect(() => parseSource("github:org")).toThrow(/expected format org\/repo/);
        });

        it("throws SourceParseError for github: with empty org", () => {
            expect(() => parseSource("github:/repo")).toThrow(SourceParseError);
        });

        it("throws SourceParseError for gitlab: with missing repo", () => {
            expect(() => parseSource("gitlab:org")).toThrow(SourceParseError);
            expect(() => parseSource("gitlab:org")).toThrow(/expected format org\/repo/);
        });
    });

    describe("File sources", () => {
        it("parses file:path/to/profile", () => {
            const result = parseSource("file:path/to/profile");

            expect(result).toEqual({
                provider: "file",
                path: "path/to/profile",
            });
        });

        it("parses file:./relative/path", () => {
            const result = parseSource("file:./relative/path");

            expect(result).toEqual({
                provider: "file",
                path: "./relative/path",
            });
        });

        it("parses file:/absolute/path", () => {
            const result = parseSource("file:/absolute/path");

            expect(result).toEqual({
                provider: "file",
                path: "/absolute/path",
            });
        });

        it("parses file:../parent/path", () => {
            const result = parseSource("file:../parent/path");

            expect(result).toEqual({
                provider: "file",
                path: "../parent/path",
            });
        });

        it("throws SourceParseError for file: without path", () => {
            expect(() => parseSource("file:")).toThrow(SourceParseError);
            expect(() => parseSource("file:")).toThrow(/missing path/);
        });
    });

    describe("NPM sources", () => {
        it("parses npm:package", () => {
            const result = parseSource("npm:baton-profiles");

            expect(result).toEqual({
                provider: "npm",
                package: "baton-profiles",
            });
        });

        it("parses npm:@scope/package", () => {
            const result = parseSource("npm:@baton/profiles");

            expect(result).toEqual({
                provider: "npm",
                package: "@baton/profiles",
                scope: "baton",
            });
        });

        it("parses npm:package/subpath", () => {
            const result = parseSource("npm:baton-profiles/frontend");

            expect(result).toEqual({
                provider: "npm",
                package: "baton-profiles",
                subpath: "frontend",
            });
        });

        it("parses npm:@scope/package/subpath", () => {
            const result = parseSource("npm:@baton/profiles/backend");

            expect(result).toEqual({
                provider: "npm",
                package: "@baton/profiles",
                scope: "baton",
                subpath: "backend",
            });
        });

        it("parses npm:@scope/package/deep/subpath", () => {
            const result = parseSource("npm:@acme/monorepo/packages/profile");

            expect(result).toEqual({
                provider: "npm",
                package: "@acme/monorepo",
                scope: "acme",
                subpath: "packages/profile",
            });
        });

        it("throws SourceParseError for npm: without package", () => {
            expect(() => parseSource("npm:")).toThrow(SourceParseError);
            expect(() => parseSource("npm:")).toThrow(/missing package name/);
        });

        it("throws SourceParseError for npm:@ without package", () => {
            expect(() => parseSource("npm:@")).toThrow(SourceParseError);
            expect(() => parseSource("npm:@")).toThrow(/scoped package must have format/);
        });

        it("throws SourceParseError for npm:@scope without package", () => {
            expect(() => parseSource("npm:@scope")).toThrow(SourceParseError);
            expect(() => parseSource("npm:@scope")).toThrow(/scoped package must have format/);
        });

        it("throws SourceParseError for npm:@scope/ without package name", () => {
            expect(() => parseSource("npm:@scope/")).toThrow(SourceParseError);
        });
    });

    describe("expandLocalPath", () => {
        it("expands ~/ to home directory", () => {
            expect(expandLocalPath("~/foo/bar", "/any/base")).toBe(join(homedir(), "foo/bar"));
        });

        it("returns absolute path as-is", () => {
            expect(expandLocalPath("/usr/local/lib", "/any/base")).toBe("/usr/local/lib");
        });

        it("resolves ./ relative to baseDir", () => {
            expect(expandLocalPath("./profiles", "/home/user/project")).toBe(
                "/home/user/project/profiles",
            );
        });

        it("resolves ../ relative to baseDir", () => {
            expect(expandLocalPath("../sibling", "/home/user/project")).toBe("/home/user/sibling");
        });
    });

    describe("Edge cases", () => {
        it("handles whitespace in source string", () => {
            const result = parseSource("  github:acme/profiles  ");

            expect(result).toEqual({
                provider: "github",
                org: "acme",
                repo: "profiles",
                url: "https://github.com/acme/profiles.git",
            });
        });

        it("handles deep subpaths", () => {
            const result = parseSource("github:acme/mono/a/b/c/d");

            expect(result).toEqual({
                provider: "github",
                org: "acme",
                repo: "mono",
                subpath: "a/b/c/d",
                url: "https://github.com/acme/mono.git",
            });
        });

        it("handles subpath with ref", () => {
            const result = parseSource("github:acme/mono/profiles@v2.1.0");

            expect(result).toEqual({
                provider: "github",
                org: "acme",
                repo: "mono",
                subpath: "profiles",
                ref: "v2.1.0",
                url: "https://github.com/acme/mono.git",
            });
        });
    });
});
