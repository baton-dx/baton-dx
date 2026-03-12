import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { evaluateCondition } from "../conditional.js";
import type { DirectiveContext } from "../types.js";
import { clearHasCache } from "./has-registry.js";

function makeContext(overrides: Partial<DirectiveContext> = {}): DirectiveContext {
    return {
        projectRoot: "/project",
        currentTool: "claude-code",
        detectedTools: ["claude-code", "cursor"],
        detectedIdes: ["vscode"],
        scope: "project",
        contentType: "memory",
        ...overrides,
    };
}

describe("file condition", () => {
    let projectRoot: string;

    beforeEach(async () => {
        projectRoot = join(tmpdir(), `baton-cond-file-${Date.now()}`);
        await mkdir(projectRoot, { recursive: true });
    });

    afterEach(async () => {
        await rm(projectRoot, { recursive: true, force: true });
    });

    it('file="biome.json" passes when file exists', async () => {
        await writeFile(join(projectRoot, "biome.json"), "{}");
        expect(await evaluateCondition({ file: "biome.json" }, makeContext({ projectRoot }))).toBe(
            true,
        );
    });

    it('file="biome.json" fails when file missing', async () => {
        expect(await evaluateCondition({ file: "biome.json" }, makeContext({ projectRoot }))).toBe(
            false,
        );
    });

    it('file="a.json,b.json" OR logic — one exists', async () => {
        await writeFile(join(projectRoot, "b.json"), "{}");
        expect(
            await evaluateCondition({ file: "a.json,b.json" }, makeContext({ projectRoot })),
        ).toBe(true);
    });

    it('not-file="eslint.config.js" passes when missing', async () => {
        expect(
            await evaluateCondition(
                { "not-file": "eslint.config.js" },
                makeContext({ projectRoot }),
            ),
        ).toBe(true);
    });

    it('not-file="eslint.config.js" fails when exists', async () => {
        await writeFile(join(projectRoot, "eslint.config.js"), "");
        expect(
            await evaluateCondition(
                { "not-file": "eslint.config.js" },
                makeContext({ projectRoot }),
            ),
        ).toBe(false);
    });

    it("AND-composition: tool + file", async () => {
        await writeFile(join(projectRoot, "biome.json"), "{}");
        expect(
            await evaluateCondition(
                { tool: "claude-code", file: "biome.json" },
                makeContext({ projectRoot }),
            ),
        ).toBe(true);
        expect(
            await evaluateCondition(
                { tool: "cursor", file: "biome.json" },
                makeContext({ projectRoot }),
            ),
        ).toBe(false);
    });
});

describe("has condition", () => {
    let projectRoot: string;

    beforeEach(async () => {
        projectRoot = join(tmpdir(), `baton-cond-has-${Date.now()}`);
        await mkdir(projectRoot, { recursive: true });
        clearHasCache();
    });

    afterEach(async () => {
        await rm(projectRoot, { recursive: true, force: true });
        clearHasCache();
    });

    it('has="typescript" passes when tsconfig.json exists', async () => {
        await writeFile(join(projectRoot, "tsconfig.json"), "{}");
        expect(await evaluateCondition({ has: "typescript" }, makeContext({ projectRoot }))).toBe(
            true,
        );
    });

    it('has="typescript" fails when tsconfig.json missing', async () => {
        expect(await evaluateCondition({ has: "typescript" }, makeContext({ projectRoot }))).toBe(
            false,
        );
    });

    it('has="react" passes when react in package.json deps', async () => {
        await writeFile(
            join(projectRoot, "package.json"),
            JSON.stringify({ dependencies: { react: "^18" } }),
        );
        expect(await evaluateCondition({ has: "react" }, makeContext({ projectRoot }))).toBe(true);
    });

    it('has="react" passes when react in devDeps', async () => {
        clearHasCache();
        await writeFile(
            join(projectRoot, "package.json"),
            JSON.stringify({ devDependencies: { react: "^18" } }),
        );
        expect(await evaluateCondition({ has: "react" }, makeContext({ projectRoot }))).toBe(true);
    });

    it('has="docker" passes when Dockerfile exists', async () => {
        await writeFile(join(projectRoot, "Dockerfile"), "FROM node:20");
        expect(await evaluateCondition({ has: "docker" }, makeContext({ projectRoot }))).toBe(true);
    });

    it('has="monorepo" passes when workspaces in package.json', async () => {
        await writeFile(
            join(projectRoot, "package.json"),
            JSON.stringify({ workspaces: ["packages/*"] }),
        );
        expect(await evaluateCondition({ has: "monorepo" }, makeContext({ projectRoot }))).toBe(
            true,
        );
    });

    it('has="python" passes when pyproject.toml exists', async () => {
        await writeFile(join(projectRoot, "pyproject.toml"), "");
        expect(await evaluateCondition({ has: "python" }, makeContext({ projectRoot }))).toBe(true);
    });

    it('has="rust" passes when Cargo.toml exists', async () => {
        await writeFile(join(projectRoot, "Cargo.toml"), "");
        expect(await evaluateCondition({ has: "rust" }, makeContext({ projectRoot }))).toBe(true);
    });

    it('has="go" passes when go.mod exists', async () => {
        await writeFile(join(projectRoot, "go.mod"), "");
        expect(await evaluateCondition({ has: "go" }, makeContext({ projectRoot }))).toBe(true);
    });

    it('not-has="prettier" passes when no prettier detected', async () => {
        expect(
            await evaluateCondition({ "not-has": "prettier" }, makeContext({ projectRoot })),
        ).toBe(true);
    });

    it('has="typescript,react" OR logic', async () => {
        await writeFile(join(projectRoot, "tsconfig.json"), "{}");
        // typescript exists, react doesn't — OR should pass
        expect(
            await evaluateCondition({ has: "typescript,react" }, makeContext({ projectRoot })),
        ).toBe(true);
    });

    it("unknown has key → false (not detected)", async () => {
        expect(
            await evaluateCondition({ has: "nonexistent-thing" }, makeContext({ projectRoot })),
        ).toBe(false);
    });
});
