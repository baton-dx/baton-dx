import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { validateSource } from "@baton-dx/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("source validate (integration)", () => {
    const testDir = join(process.cwd(), "tmp", "validate-cli-test");

    beforeEach(async () => {
        await mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it("validates a fully valid source repo with no issues", async () => {
        await writeFile(
            join(testDir, "baton.source.yaml"),
            `name: "my-source"
version: "1.0.0"
`,
        );
        await mkdir(join(testDir, "profiles", "default", "ai", "memory"), { recursive: true });
        await writeFile(
            join(testDir, "profiles", "default", "baton.profile.yaml"),
            `name: "default"
version: "1.0.0"
`,
        );
        await writeFile(
            join(testDir, "profiles", "default", "ai", "memory", "MEMORY.md"),
            "# Memory\n",
        );

        const report = await validateSource(testDir);
        expect(report.valid).toBe(true);
        expect(report.summary.errors).toBe(0);
        expect(report.summary.warnings).toBe(0);
        expect(report.summary.profilesChecked).toBe(1);
    });

    it("validates a complex source with multiple issues", async () => {
        // Legacy 'profiles' field in source manifest triggers error (Check 0a)
        await writeFile(
            join(testDir, "baton.source.yaml"),
            `name: "my-source"
version: "1.0.0"
ai:
  tools:
    - claude-code
    - fake-tool
profiles:
  - name: "default"
    path: "profiles/default"
  - name: "missing"
    path: "profiles/missing"
`,
        );
        await mkdir(join(testDir, "profiles", "default"), { recursive: true });
        await writeFile(
            join(testDir, "profiles", "default", "baton.profile.yaml"),
            `name: "default"
version: "1.0.0"
`,
        );

        const report = await validateSource(testDir);
        expect(report.valid).toBe(false);
        expect(report.summary.errors).toBeGreaterThanOrEqual(1);
    });
});
