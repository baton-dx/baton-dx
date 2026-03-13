import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DirectiveContext } from "../types.js";
import { evaluateExpressionCondition } from "./index.js";

function makeContext(overrides: Partial<DirectiveContext> = {}): DirectiveContext {
    return {
        projectRoot: "/tmp/test",
        currentTool: "claude-code",
        detectedTools: ["claude-code", "cursor"],
        detectedIdes: ["vscode"],
        scope: "project",
        contentType: "memory",
        ...overrides,
    };
}

describe("evaluateExpressionCondition", () => {
    // --- Property comparisons ---

    it("tool == matching", async () => {
        expect(await evaluateExpressionCondition("tool == 'claude-code'", makeContext())).toBe(
            true,
        );
    });

    it("tool == non-matching", async () => {
        expect(await evaluateExpressionCondition("tool == 'cursor'", makeContext())).toBe(false);
    });

    it("tool != matching", async () => {
        expect(await evaluateExpressionCondition("tool != 'cursor'", makeContext())).toBe(true);
    });

    it("tool != non-matching", async () => {
        expect(await evaluateExpressionCondition("tool != 'claude-code'", makeContext())).toBe(
            false,
        );
    });

    it("scope comparison", async () => {
        expect(await evaluateExpressionCondition("scope == 'project'", makeContext())).toBe(true);
        expect(await evaluateExpressionCondition("scope == 'global'", makeContext())).toBe(false);
    });

    it("type comparison", async () => {
        expect(await evaluateExpressionCondition("type == 'memory'", makeContext())).toBe(true);
        expect(await evaluateExpressionCondition("type == 'rules'", makeContext())).toBe(false);
    });

    it("ide comparison", async () => {
        expect(await evaluateExpressionCondition("ide == 'vscode'", makeContext())).toBe(true);
        expect(await evaluateExpressionCondition("ide == 'jetbrains'", makeContext())).toBe(false);
    });

    // --- Logical operators ---

    it("OR: first true", async () => {
        expect(
            await evaluateExpressionCondition(
                "tool == 'claude-code' OR tool == 'cursor'",
                makeContext(),
            ),
        ).toBe(true);
    });

    it("OR: second true", async () => {
        expect(
            await evaluateExpressionCondition(
                "tool == 'windsurf' OR scope == 'project'",
                makeContext(),
            ),
        ).toBe(true);
    });

    it("OR: both false", async () => {
        expect(
            await evaluateExpressionCondition(
                "tool == 'windsurf' OR scope == 'global'",
                makeContext(),
            ),
        ).toBe(false);
    });

    it("AND: both true", async () => {
        expect(
            await evaluateExpressionCondition(
                "tool == 'claude-code' AND scope == 'project'",
                makeContext(),
            ),
        ).toBe(true);
    });

    it("AND: one false", async () => {
        expect(
            await evaluateExpressionCondition(
                "tool == 'claude-code' AND scope == 'global'",
                makeContext(),
            ),
        ).toBe(false);
    });

    it("NOT: negates true", async () => {
        expect(await evaluateExpressionCondition("NOT tool == 'cursor'", makeContext())).toBe(true);
    });

    it("NOT: negates false to true", async () => {
        expect(await evaluateExpressionCondition("NOT tool == 'claude-code'", makeContext())).toBe(
            false,
        );
    });

    // --- Grouped expressions ---

    it("grouped OR with AND", async () => {
        expect(
            await evaluateExpressionCondition(
                "(tool == 'claude-code' OR tool == 'cursor') AND scope == 'project'",
                makeContext(),
            ),
        ).toBe(true);

        expect(
            await evaluateExpressionCondition(
                "(tool == 'windsurf' OR tool == 'aider') AND scope == 'project'",
                makeContext(),
            ),
        ).toBe(false);
    });

    // --- IN expressions ---

    it("IN: matching tool in list", async () => {
        expect(
            await evaluateExpressionCondition("tool IN ['claude-code', 'cursor']", makeContext()),
        ).toBe(true);
    });

    it("IN: non-matching tool", async () => {
        expect(
            await evaluateExpressionCondition("tool IN ['cursor', 'windsurf']", makeContext()),
        ).toBe(false);
    });

    it("NOT IN: tool not in list", async () => {
        expect(
            await evaluateExpressionCondition("tool NOT IN ['cursor', 'windsurf']", makeContext()),
        ).toBe(true);
    });

    it("NOT IN: tool in list", async () => {
        expect(
            await evaluateExpressionCondition(
                "tool NOT IN ['claude-code', 'cursor']",
                makeContext(),
            ),
        ).toBe(false);
    });

    it("IN with ide property", async () => {
        expect(
            await evaluateExpressionCondition("ide IN ['vscode', 'jetbrains']", makeContext()),
        ).toBe(true);
    });

    it("IN combined with AND", async () => {
        expect(
            await evaluateExpressionCondition(
                "tool IN ['claude-code', 'cursor'] AND scope == 'project'",
                makeContext(),
            ),
        ).toBe(true);

        expect(
            await evaluateExpressionCondition(
                "tool IN ['claude-code', 'cursor'] AND scope == 'global'",
                makeContext(),
            ),
        ).toBe(false);
    });

    // --- var() function ---

    it("var existence check — exists", async () => {
        expect(
            await evaluateExpressionCondition(
                "var('lang')",
                makeContext({ variables: { lang: "ts" } }),
            ),
        ).toBe(true);
    });

    it("var existence check — missing", async () => {
        expect(
            await evaluateExpressionCondition("var('lang')", makeContext({ variables: {} })),
        ).toBe(false);
    });

    it("var existence check — empty string", async () => {
        expect(
            await evaluateExpressionCondition(
                "var('lang')",
                makeContext({ variables: { lang: "" } }),
            ),
        ).toBe(false);
    });

    it("var comparison", async () => {
        expect(
            await evaluateExpressionCondition(
                "var('lang') == 'typescript'",
                makeContext({ variables: { lang: "typescript" } }),
            ),
        ).toBe(true);
        expect(
            await evaluateExpressionCondition(
                "var('lang') != 'typescript'",
                makeContext({ variables: { lang: "python" } }),
            ),
        ).toBe(true);
    });

    // --- file() function ---

    let projectRoot: string;

    beforeEach(async () => {
        projectRoot = join(tmpdir(), `baton-eval-test-${Date.now()}`);
        await mkdir(projectRoot, { recursive: true });
    });

    afterEach(async () => {
        await rm(projectRoot, { recursive: true, force: true });
    });

    it("file() — exists", async () => {
        await writeFile(join(projectRoot, "biome.json"), "{}");
        expect(
            await evaluateExpressionCondition("file('biome.json')", makeContext({ projectRoot })),
        ).toBe(true);
    });

    it("file() — not exists", async () => {
        expect(
            await evaluateExpressionCondition("file('biome.json')", makeContext({ projectRoot })),
        ).toBe(false);
    });

    it("file() with OR", async () => {
        await writeFile(join(projectRoot, "biome.jsonc"), "{}");
        expect(
            await evaluateExpressionCondition(
                "file('biome.json') OR file('biome.jsonc')",
                makeContext({ projectRoot }),
            ),
        ).toBe(true);
    });

    // --- has() function ---

    it("has() — typescript (with tsconfig.json)", async () => {
        await writeFile(join(projectRoot, "tsconfig.json"), "{}");
        expect(
            await evaluateExpressionCondition("has('typescript')", makeContext({ projectRoot })),
        ).toBe(true);
    });

    it("has() — typescript (without tsconfig.json)", async () => {
        expect(
            await evaluateExpressionCondition("has('typescript')", makeContext({ projectRoot })),
        ).toBe(false);
    });

    it("NOT has()", async () => {
        expect(
            await evaluateExpressionCondition(
                "NOT has('typescript')",
                makeContext({ projectRoot }),
            ),
        ).toBe(true);
    });

    // --- Warnings ---

    it("unknown property emits warning, returns false", async () => {
        const warn = vi.fn();
        const result = await evaluateExpressionCondition("foo == 'bar'", makeContext(), warn);
        expect(result).toBe(false);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("Unknown property 'foo'"));
    });

    it("unknown function emits warning, returns false", async () => {
        const warn = vi.fn();
        const result = await evaluateExpressionCondition("baz('x')", makeContext(), warn);
        expect(result).toBe(false);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("Unknown function 'baz()'"));
    });

    it("parse error emits warning and fails open", async () => {
        const warn = vi.fn();
        const result = await evaluateExpressionCondition("tool == invalid", makeContext(), warn);
        expect(result).toBe(true); // fail-open
        expect(warn).toHaveBeenCalled();
    });
});
