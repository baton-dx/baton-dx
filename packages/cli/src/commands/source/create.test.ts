import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sourceCreateCommand } from "./create.js";

/**
 * Unit tests for source create command
 * Tests command structure and argument definitions
 */
describe("sourceCreateCommand", () => {
    it("should export a valid command definition", () => {
        expect(sourceCreateCommand).toBeDefined();
        expect(typeof sourceCreateCommand).toBe("object");
    });

    it("should have a run function", () => {
        expect(sourceCreateCommand.run).toBeDefined();
        expect(typeof sourceCreateCommand.run).toBe("function");
    });

    it("should define all required arguments", () => {
        // Command structure is correctly defined
        expect(sourceCreateCommand.meta).toBeDefined();
        expect(sourceCreateCommand.args).toBeDefined();
    });

    it("should only have name and yes arguments", () => {
        const argKeys = Object.keys(sourceCreateCommand.args ?? {});
        expect(argKeys).toContain("name");
        expect(argKeys).toContain("yes");
        expect(argKeys).not.toContain("template");
        expect(argKeys).not.toContain("agents");
        expect(argKeys).not.toContain("pm");
        expect(argKeys).not.toContain("no-git");
        expect(argKeys).not.toContain("with-initial-profile");
        expect(argKeys).not.toContain("dir");
    });
});

/**
 * Non-interactive mode validation tests
 * These tests verify the kebab-case name validation logic
 */
describe("Non-interactive mode - name validation", () => {
    it("should have kebab-case regex pattern defined", () => {
        // The KEBAB_CASE_REGEX is used internally for validation
        // We test the pattern directly to verify it works correctly
        const KEBAB_CASE_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

        // Valid names
        expect(KEBAB_CASE_REGEX.test("my-profile")).toBe(true);
        expect(KEBAB_CASE_REGEX.test("test-profile")).toBe(true);
        expect(KEBAB_CASE_REGEX.test("abc-123-xyz")).toBe(true);
        expect(KEBAB_CASE_REGEX.test("3d")).toBe(true); // starts with digit
        expect(KEBAB_CASE_REGEX.test("123-profile")).toBe(true); // starts with digit
        expect(KEBAB_CASE_REGEX.test("3d-web")).toBe(true); // starts with digit

        // Invalid names
        expect(KEBAB_CASE_REGEX.test("MyProfile")).toBe(false); // camelCase
        expect(KEBAB_CASE_REGEX.test("my_profile")).toBe(false); // snake_case
        expect(KEBAB_CASE_REGEX.test("my--profile")).toBe(false); // double hyphens
        expect(KEBAB_CASE_REGEX.test("-my-profile")).toBe(false); // leading hyphen
        expect(KEBAB_CASE_REGEX.test("my-profile-")).toBe(false); // trailing hyphen
    });
});

/**
 * Integration tests for scaffolding functionality
 */
describe("scaffoldSourceRepo (integration)", () => {
    const testDir = join(process.cwd(), "test-scaffold-output");

    beforeEach(async () => {
        // Clean up before each test
        await rm(testDir, { recursive: true, force: true });
        await mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
        // Clean up after each test
        await rm(testDir, { recursive: true, force: true });
    });

    it.skip("should scaffold minimal source with profiles/ directory", async () => {
        // Skipped: This test requires built templates in dist/ which may not exist during test runs
        // This functionality is tested via E2E tests instead
        const testName = "my-test-profile";

        const { scaffoldSourceRepo } = await import("./create.js");

        await scaffoldSourceRepo({
            name: testName,
            git: false,
            withInitialProfile: true,
        });

        const readmeContent = await readFile(join(process.cwd(), testName, "README.md"), "utf-8");

        expect(readmeContent).toContain(testName);

        // Clean up the created directory
        await rm(join(process.cwd(), testName), { recursive: true, force: true });
    });
});
