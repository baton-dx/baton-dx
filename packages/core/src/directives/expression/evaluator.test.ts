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

    it("or: first true", async () => {
        expect(
            await evaluateExpressionCondition(
                "tool == 'claude-code' or tool == 'cursor'",
                makeContext(),
            ),
        ).toBe(true);
    });

    it("or: second true", async () => {
        expect(
            await evaluateExpressionCondition(
                "tool == 'windsurf' or scope == 'project'",
                makeContext(),
            ),
        ).toBe(true);
    });

    it("or: both false", async () => {
        expect(
            await evaluateExpressionCondition(
                "tool == 'windsurf' or scope == 'global'",
                makeContext(),
            ),
        ).toBe(false);
    });

    it("and: both true", async () => {
        expect(
            await evaluateExpressionCondition(
                "tool == 'claude-code' and scope == 'project'",
                makeContext(),
            ),
        ).toBe(true);
    });

    it("and: one false", async () => {
        expect(
            await evaluateExpressionCondition(
                "tool == 'claude-code' and scope == 'global'",
                makeContext(),
            ),
        ).toBe(false);
    });

    it("not: negates true", async () => {
        expect(await evaluateExpressionCondition("not tool == 'cursor'", makeContext())).toBe(true);
    });

    it("not: negates false to true", async () => {
        expect(await evaluateExpressionCondition("not tool == 'claude-code'", makeContext())).toBe(
            false,
        );
    });

    // --- Case-insensitive operators ---

    it("uppercase OR: non-matching returns false", async () => {
        expect(
            await evaluateExpressionCondition(
                "tool == 'claude-code' OR tool == 'antigravity'",
                makeContext({ currentTool: "cursor" }),
            ),
        ).toBe(false);
    });

    it("uppercase AND: evaluates correctly", async () => {
        expect(
            await evaluateExpressionCondition(
                "tool == 'claude-code' AND scope == 'project'",
                makeContext(),
            ),
        ).toBe(true);
        expect(
            await evaluateExpressionCondition(
                "tool == 'claude-code' AND scope == 'global'",
                makeContext(),
            ),
        ).toBe(false);
    });

    it("uppercase NOT: negates correctly", async () => {
        expect(await evaluateExpressionCondition("NOT tool == 'cursor'", makeContext())).toBe(true);
    });

    // --- Grouped expressions ---

    it("grouped or with and", async () => {
        expect(
            await evaluateExpressionCondition(
                "(tool == 'claude-code' or tool == 'cursor') and scope == 'project'",
                makeContext(),
            ),
        ).toBe(true);

        expect(
            await evaluateExpressionCondition(
                "(tool == 'windsurf' or tool == 'aider') and scope == 'project'",
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

    it("file() with or", async () => {
        await writeFile(join(projectRoot, "biome.jsonc"), "{}");
        expect(
            await evaluateExpressionCondition(
                "file('biome.json') or file('biome.jsonc')",
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

    it("not has()", async () => {
        expect(
            await evaluateExpressionCondition(
                "not has('typescript')",
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

    // --- Symbol operators ---

    it("&& and || aliases work", async () => {
        expect(
            await evaluateExpressionCondition(
                "tool == 'claude-code' && scope == 'project'",
                makeContext(),
            ),
        ).toBe(true);
        expect(
            await evaluateExpressionCondition(
                "tool == 'windsurf' || scope == 'project'",
                makeContext(),
            ),
        ).toBe(true);
    });

    it("! alias for not", async () => {
        expect(await evaluateExpressionCondition("!tool == 'cursor'", makeContext())).toBe(true);
    });
});
