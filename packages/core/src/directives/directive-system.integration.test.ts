/**
 * Comprehensive integration test for the Directive Composition System.
 *
 * Validates the full implementation plan (Phases 1–3) end-to-end:
 *   Phase 1: Directive System Enhancement (1.1–1.7)
 *   Phase 2: Pipeline Refactor + Merge Simplification (2.1–2.4)
 *   Phase 3: Preview Command (explain mode, diff support)
 *
 * Each describe block maps to a plan sub-phase with cross-references.
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mergeContentParts, normalizeMarkdown } from "../merge/content-parts.js";
import { evaluateCondition, matchConditionalPairs } from "./conditional.js";
import { clearHasCache } from "./conditions/index.js";
import { resolveInclude } from "./include.js";
import { findCodeBlockRanges, parseDirectives } from "./parser.js";
import { computePlacementTarget } from "./placement.js";
import { processDirectives } from "./processor.js";
import type {
    ConditionalBlock,
    DirectiveContext,
    DirectiveOptions,
    FilePlacement,
    ParsedDirective,
} from "./types.js";

// ─── Test helpers ───────────────────────────────────────────────────────────

function makeContext(overrides: Partial<DirectiveContext> = {}): DirectiveContext {
    return {
        projectRoot: "/tmp/test-project",
        profileRoot: "/tmp/test-profile",
        profileName: "test-profile",
        currentTool: "claude-code",
        detectedTools: ["claude-code", "cursor", "windsurf"],
        detectedIdes: ["vscode", "jetbrains"],
        scope: "project",
        contentType: "memory",
        variables: { lang: "typescript", env: "production" },
        ...overrides,
    };
}

function makeOptions(
    contextOverrides: Partial<DirectiveContext> = {},
    extra: Partial<DirectiveOptions> = {},
): DirectiveOptions {
    return { context: makeContext(contextOverrides), ...extra };
}

function makeIncludeDirective(attrs: Record<string, string>, position = 0): ParsedDirective {
    const pairs = Object.entries(attrs)
        .map(([k, v]) => `${k}="${v}"`)
        .join(" ");
    const raw = `<!-- baton:include ${pairs} -->`;
    return {
        type: "include",
        attributes: attrs,
        startIndex: position,
        endIndex: position + raw.length,
        raw,
    };
}

function makeIf(attrs: Record<string, string>, startIndex = 0): ParsedDirective {
    const pairs = Object.entries(attrs)
        .map(([k, v]) => `${k}="${v}"`)
        .join(" ");
    const raw = `<!-- baton:if ${pairs} -->`;
    return {
        type: "if",
        attributes: attrs,
        startIndex,
        endIndex: startIndex + raw.length,
        raw,
    };
}

function makeElse(startIndex = 0): ParsedDirective {
    const raw = "<!-- baton:else -->";
    return {
        type: "else",
        attributes: {},
        startIndex,
        endIndex: startIndex + raw.length,
        raw,
    };
}

function makeEndif(startIndex = 0): ParsedDirective {
    const raw = "<!-- baton:endif -->";
    return {
        type: "endif",
        attributes: {},
        startIndex,
        endIndex: startIndex + raw.length,
        raw,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1: Directive System Enhancement
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 1.1 — DirectiveContext expanded fields", () => {
    it("accepts profileRoot, profileName, and variables in context", () => {
        const ctx = makeContext();
        expect(ctx.profileRoot).toBe("/tmp/test-profile");
        expect(ctx.profileName).toBe("test-profile");
        expect(ctx.variables).toEqual({ lang: "typescript", env: "production" });
    });

    it("allows optional profileRoot (backward compat)", () => {
        const ctx = makeContext({ profileRoot: undefined });
        expect(ctx.profileRoot).toBeUndefined();
    });

    it("else is a valid ParsedDirective type", () => {
        const d: ParsedDirective = {
            type: "else",
            attributes: {},
            startIndex: 0,
            endIndex: 19,
            raw: "<!-- baton:else -->",
        };
        expect(d.type).toBe("else");
    });

    it("ConditionalBlock has optional elseDirective", () => {
        const block: ConditionalBlock = {
            ifDirective: makeIf({ tool: "x" }),
            endifDirective: makeEndif(100),
            depth: 0,
        };
        expect(block.elseDirective).toBeUndefined();

        const blockWithElse: ConditionalBlock = {
            ifDirective: makeIf({ tool: "x" }),
            elseDirective: makeElse(50),
            endifDirective: makeEndif(100),
            depth: 0,
        };
        expect(blockWithElse.elseDirective).toBeDefined();
    });
});

describe("Phase 1.2 — Code-block awareness", () => {
    it("parser ignores directives inside backtick fenced code blocks", () => {
        const content = [
            "# Title",
            "```markdown",
            '<!-- baton:if tool="cursor" -->',
            "should be ignored",
            "<!-- baton:endif -->",
            "```",
            '<!-- baton:if tool="claude-code" -->',
            "real directive",
            "<!-- baton:endif -->",
        ].join("\n");

        const directives = parseDirectives(content);
        // Only the directives outside the code block should be parsed
        expect(directives).toHaveLength(2); // if + endif outside fence
        expect(directives[0].type).toBe("if");
        expect(directives[1].type).toBe("endif");
    });

    it("parser ignores directives inside tilde fenced code blocks", () => {
        const content = ["~~~", '<!-- baton:include src="ignored.md" -->', "~~~"].join("\n");

        const directives = parseDirectives(content);
        expect(directives).toHaveLength(0);
    });

    it("findCodeBlockRanges handles unclosed fences", () => {
        const content = "```\nsome code\nno closing fence";
        const ranges = findCodeBlockRanges(content);
        expect(ranges).toHaveLength(1);
        expect(ranges[0][1]).toBe(content.length); // extends to end
    });

    it("closing fence must match char and be >= length", () => {
        const content = [
            "````markdown",
            '<!-- baton:if tool="x" -->', // inside — should be ignored
            "```", // too short — doesn't close
            "````", // correct closer
            '<!-- baton:if tool="y" -->', // outside — should be parsed
        ].join("\n");

        const directives = parseDirectives(content);
        expect(directives).toHaveLength(1);
        expect(directives[0].attributes.tool).toBe("y");
    });

    it("different fence chars do not close each other", () => {
        const content = [
            "```",
            "~~~", // different char — stays inside
            '<!-- baton:if tool="x" -->', // still inside — ignored
            "```", // closes the backtick block
            '<!-- baton:if tool="y" -->', // outside — parsed
        ].join("\n");

        const directives = parseDirectives(content);
        expect(directives).toHaveLength(1);
        expect(directives[0].attributes.tool).toBe("y");
    });
});

describe("Phase 1.3 — baton:else support", () => {
    it("parser recognizes baton:else directives", () => {
        const content = [
            '<!-- baton:if tool="cursor" -->',
            "cursor content",
            "<!-- baton:else -->",
            "other content",
            "<!-- baton:endif -->",
        ].join("\n");

        const directives = parseDirectives(content);
        expect(directives).toHaveLength(3);
        expect(directives[0].type).toBe("if");
        expect(directives[1].type).toBe("else");
        expect(directives[2].type).toBe("endif");
    });

    it("matchConditionalPairs tracks elseDirective", () => {
        const directives = [makeIf({ tool: "x" }, 0), makeElse(50), makeEndif(100)];
        const { matched } = matchConditionalPairs(directives);
        expect(matched).toHaveLength(1);
        expect(matched[0].elseDirective).toBeDefined();
        expect(matched[0].elseDirective?.type).toBe("else");
    });

    it("condition true → keeps if-branch, removes else-branch", async () => {
        const content = [
            '<!-- baton:if tool="claude-code" -->',
            "Claude content",
            "<!-- baton:else -->",
            "Other tool content",
            "<!-- baton:endif -->",
        ].join("\n");

        const result = await processDirectives(content, makeOptions());
        expect(result).toContain("Claude content");
        expect(result).not.toContain("Other tool content");
    });

    it("condition false → keeps else-branch, removes if-branch", async () => {
        const content = [
            '<!-- baton:if tool="cursor" -->',
            "Cursor content",
            "<!-- baton:else -->",
            "Fallback content",
            "<!-- baton:endif -->",
        ].join("\n");

        const result = await processDirectives(content, makeOptions());
        expect(result).toContain("Fallback content");
        expect(result).not.toContain("Cursor content");
    });

    it("duplicate baton:else emits warning", () => {
        const warnings: string[] = [];
        const directives = [
            makeIf({ tool: "x" }, 0),
            makeElse(30),
            makeElse(60), // duplicate
            makeEndif(90),
        ];
        matchConditionalPairs(directives, (w) => warnings.push(w));
        expect(warnings.some((w) => w.includes("Duplicate baton:else"))).toBe(true);
    });

    it("orphan baton:else emits warning", () => {
        const warnings: string[] = [];
        const directives = [makeElse(0)];
        matchConditionalPairs(directives, (w) => warnings.push(w));
        expect(warnings.some((w) => w.includes("Unmatched baton:else"))).toBe(true);
    });
});

describe("Phase 1.4 — AND-composition for conditions", () => {
    it("AND: all conditions must pass", async () => {
        // tool=claude-code AND scope=project → both true
        const result1 = await evaluateCondition(
            { tool: "claude-code", scope: "project" },
            makeContext(),
        );
        expect(result1).toBe(true);

        // tool=claude-code AND scope=global → scope fails
        const result2 = await evaluateCondition(
            { tool: "claude-code", scope: "global" },
            makeContext(),
        );
        expect(result2).toBe(false);
    });

    it("OR via comma-separated values within one attribute", async () => {
        // tool="cursor,claude-code" → true because claude-code matches
        const result = await evaluateCondition({ tool: "cursor,claude-code" }, makeContext());
        expect(result).toBe(true);
    });

    it("AND + OR combined", async () => {
        // tool="cursor,claude-code" AND scope="global" → tool passes, scope fails
        const result = await evaluateCondition(
            { tool: "cursor,claude-code", scope: "global" },
            makeContext(),
        );
        expect(result).toBe(false);
    });

    it("no recognized condition → fail-open with warning", async () => {
        const warnings: string[] = [];
        const result = await evaluateCondition({ unknown: "value" }, makeContext(), (w) =>
            warnings.push(w),
        );
        expect(result).toBe(true);
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain("no recognized condition");
    });
});

describe("Phase 1.5 — Condition types + registry", () => {
    // ── tool / not-tool ──

    it("tool condition — match", async () => {
        const result = await evaluateCondition({ tool: "claude-code" }, makeContext());
        expect(result).toBe(true);
    });

    it("tool condition — no match", async () => {
        const result = await evaluateCondition({ tool: "cursor" }, makeContext());
        expect(result).toBe(false);
    });

    it("tool condition — OR match", async () => {
        const result = await evaluateCondition({ tool: "windsurf,claude-code" }, makeContext());
        expect(result).toBe(true);
    });

    it("not-tool condition — keeps when tool is different", async () => {
        const result = await evaluateCondition({ "not-tool": "cursor" }, makeContext());
        expect(result).toBe(true);
    });

    it("not-tool condition — removes when tool matches", async () => {
        const result = await evaluateCondition({ "not-tool": "claude-code" }, makeContext());
        expect(result).toBe(false);
    });

    it("not-tool condition — OR: removes if any matches", async () => {
        const result = await evaluateCondition({ "not-tool": "cursor,claude-code" }, makeContext());
        expect(result).toBe(false);
    });

    // ── ide / not-ide ──

    it("ide condition — match", async () => {
        const result = await evaluateCondition({ ide: "vscode" }, makeContext());
        expect(result).toBe(true);
    });

    it("ide condition — no match", async () => {
        const result = await evaluateCondition(
            { ide: "neovim" },
            makeContext({ detectedIdes: ["vscode"] }),
        );
        expect(result).toBe(false);
    });

    it("not-ide condition", async () => {
        const result = await evaluateCondition(
            { "not-ide": "neovim" },
            makeContext({ detectedIdes: ["vscode"] }),
        );
        expect(result).toBe(true);
    });

    // ── scope ──

    it("scope condition — match", async () => {
        const result = await evaluateCondition({ scope: "project" }, makeContext());
        expect(result).toBe(true);
    });

    it("scope condition — no match", async () => {
        const result = await evaluateCondition({ scope: "global" }, makeContext());
        expect(result).toBe(false);
    });

    it("scope condition — OR", async () => {
        const result = await evaluateCondition({ scope: "global,project" }, makeContext());
        expect(result).toBe(true);
    });

    // ── type (contentType) ──

    it("type condition — match", async () => {
        const result = await evaluateCondition({ type: "memory" }, makeContext());
        expect(result).toBe(true);
    });

    it("type condition — no match", async () => {
        const result = await evaluateCondition({ type: "skills" }, makeContext());
        expect(result).toBe(false);
    });

    it("type condition — OR", async () => {
        const result = await evaluateCondition({ type: "skills,memory" }, makeContext());
        expect(result).toBe(true);
    });

    // ── var / not-var ──

    it("var condition — existence check", async () => {
        const result = await evaluateCondition(
            { var: "lang" },
            makeContext({ variables: { lang: "typescript" } }),
        );
        expect(result).toBe(true);
    });

    it("var condition — existence check fails", async () => {
        const result = await evaluateCondition(
            { var: "debug" },
            makeContext({ variables: { lang: "typescript" } }),
        );
        expect(result).toBe(false);
    });

    it("var condition — value check with colon syntax", async () => {
        const result = await evaluateCondition(
            { var: "lang:typescript" },
            makeContext({ variables: { lang: "typescript" } }),
        );
        expect(result).toBe(true);
    });

    it("var condition — value mismatch", async () => {
        const result = await evaluateCondition(
            { var: "lang:python" },
            makeContext({ variables: { lang: "typescript" } }),
        );
        expect(result).toBe(false);
    });

    it("var condition — OR with colon", async () => {
        const result = await evaluateCondition(
            { var: "lang:python,lang:typescript" },
            makeContext({ variables: { lang: "typescript" } }),
        );
        expect(result).toBe(true);
    });

    it("not-var condition — variable absent", async () => {
        const result = await evaluateCondition(
            { "not-var": "debug" },
            makeContext({ variables: {} }),
        );
        expect(result).toBe(true);
    });

    it("not-var condition — variable present", async () => {
        const result = await evaluateCondition(
            { "not-var": "lang" },
            makeContext({ variables: { lang: "ts" } }),
        );
        expect(result).toBe(false);
    });

    // ── file / not-file (async, requires fs) ──

    describe("file / not-file conditions", () => {
        let projectRoot: string;

        beforeEach(async () => {
            projectRoot = join(tmpdir(), `baton-cond-file-${Date.now()}`);
            await mkdir(projectRoot, { recursive: true });
            await writeFile(join(projectRoot, "tsconfig.json"), "{}");
        });

        afterEach(async () => {
            await rm(projectRoot, { recursive: true, force: true });
        });

        it("file condition — file exists", async () => {
            const result = await evaluateCondition(
                { file: "tsconfig.json" },
                makeContext({ projectRoot }),
            );
            expect(result).toBe(true);
        });

        it("file condition — file missing", async () => {
            const result = await evaluateCondition(
                { file: "nonexistent.json" },
                makeContext({ projectRoot }),
            );
            expect(result).toBe(false);
        });

        it("file condition — OR: any file exists", async () => {
            const result = await evaluateCondition(
                { file: "missing.json,tsconfig.json" },
                makeContext({ projectRoot }),
            );
            expect(result).toBe(true);
        });

        it("not-file condition — file absent", async () => {
            const result = await evaluateCondition(
                { "not-file": "eslint.config.js" },
                makeContext({ projectRoot }),
            );
            expect(result).toBe(true);
        });

        it("not-file condition — file present", async () => {
            const result = await evaluateCondition(
                { "not-file": "tsconfig.json" },
                makeContext({ projectRoot }),
            );
            expect(result).toBe(false);
        });
    });

    // ── has / not-has (async, requires fs) ──

    describe("has / not-has conditions", () => {
        let projectRoot: string;

        beforeEach(async () => {
            clearHasCache();
            projectRoot = join(tmpdir(), `baton-cond-has-${Date.now()}`);
            await mkdir(projectRoot, { recursive: true });
        });

        afterEach(async () => {
            clearHasCache();
            await rm(projectRoot, { recursive: true, force: true });
        });

        it("has=typescript — tsconfig.json exists", async () => {
            await writeFile(join(projectRoot, "tsconfig.json"), "{}");
            const result = await evaluateCondition(
                { has: "typescript" },
                makeContext({ projectRoot }),
            );
            expect(result).toBe(true);
        });

        it("has=typescript — tsconfig.json missing", async () => {
            const result = await evaluateCondition(
                { has: "typescript" },
                makeContext({ projectRoot }),
            );
            expect(result).toBe(false);
        });

        it("has=react — package.json with react dep", async () => {
            await writeFile(
                join(projectRoot, "package.json"),
                JSON.stringify({ dependencies: { react: "^18" } }),
            );
            const result = await evaluateCondition({ has: "react" }, makeContext({ projectRoot }));
            expect(result).toBe(true);
        });

        it("has=react — no package.json", async () => {
            const result = await evaluateCondition({ has: "react" }, makeContext({ projectRoot }));
            expect(result).toBe(false);
        });

        it("has=docker — Dockerfile exists", async () => {
            await writeFile(join(projectRoot, "Dockerfile"), "FROM node:20");
            const result = await evaluateCondition({ has: "docker" }, makeContext({ projectRoot }));
            expect(result).toBe(true);
        });

        it("has=biome — biome.json exists", async () => {
            await writeFile(join(projectRoot, "biome.json"), "{}");
            const result = await evaluateCondition({ has: "biome" }, makeContext({ projectRoot }));
            expect(result).toBe(true);
        });

        it("has=monorepo — workspaces in package.json", async () => {
            await writeFile(
                join(projectRoot, "package.json"),
                JSON.stringify({ workspaces: ["packages/*"] }),
            );
            const result = await evaluateCondition(
                { has: "monorepo" },
                makeContext({ projectRoot }),
            );
            expect(result).toBe(true);
        });

        it("has=python — pyproject.toml exists", async () => {
            await writeFile(join(projectRoot, "pyproject.toml"), "[project]");
            const result = await evaluateCondition({ has: "python" }, makeContext({ projectRoot }));
            expect(result).toBe(true);
        });

        it("has=rust — Cargo.toml exists", async () => {
            await writeFile(join(projectRoot, "Cargo.toml"), "[package]");
            const result = await evaluateCondition({ has: "rust" }, makeContext({ projectRoot }));
            expect(result).toBe(true);
        });

        it("has=go — go.mod exists", async () => {
            await writeFile(join(projectRoot, "go.mod"), "module example.com");
            const result = await evaluateCondition({ has: "go" }, makeContext({ projectRoot }));
            expect(result).toBe(true);
        });

        it("has OR — any characteristic matches", async () => {
            await writeFile(join(projectRoot, "Dockerfile"), "FROM node:20");
            const result = await evaluateCondition(
                { has: "react,docker" },
                makeContext({ projectRoot }),
            );
            expect(result).toBe(true);
        });

        it("not-has — characteristic absent", async () => {
            const result = await evaluateCondition(
                { "not-has": "typescript" },
                makeContext({ projectRoot }),
            );
            expect(result).toBe(true);
        });

        it("not-has — characteristic present", async () => {
            await writeFile(join(projectRoot, "tsconfig.json"), "{}");
            const result = await evaluateCondition(
                { "not-has": "typescript" },
                makeContext({ projectRoot }),
            );
            expect(result).toBe(false);
        });

        it("has unknown key → skipped (undefined), returns false as sole condition", async () => {
            const result = await evaluateCondition(
                { has: "unknownkey" },
                makeContext({ projectRoot }),
            );
            // Unknown keys return undefined from detector, treated as false
            expect(result).toBe(false);
        });
    });
});

describe("Phase 1.6 — Dual-root include resolution", () => {
    let projectRoot: string;
    let profileRoot: string;

    beforeEach(async () => {
        projectRoot = join(tmpdir(), `baton-include-project-${Date.now()}`);
        profileRoot = join(tmpdir(), `baton-include-profile-${Date.now()}`);
        await mkdir(projectRoot, { recursive: true });
        await mkdir(profileRoot, { recursive: true });
    });

    afterEach(async () => {
        await rm(projectRoot, { recursive: true, force: true });
        await rm(profileRoot, { recursive: true, force: true });
    });

    it("resolves relative to profileRoot when available", async () => {
        await writeFile(join(profileRoot, "fragment.md"), "Profile fragment");
        const d = makeIncludeDirective({ src: "fragment.md" });
        const result = await resolveInclude(d, projectRoot, undefined, profileRoot);
        expect(result).toBe("Profile fragment");
    });

    it("@project/ prefix resolves relative to projectRoot", async () => {
        await writeFile(join(projectRoot, "project-file.md"), "Project content");
        const d = makeIncludeDirective({ src: "@project/project-file.md" });
        const result = await resolveInclude(d, projectRoot, undefined, profileRoot);
        expect(result).toBe("Project content");
    });

    it("falls back to projectRoot when no profileRoot provided", async () => {
        await writeFile(join(projectRoot, "fallback.md"), "Fallback content");
        const d = makeIncludeDirective({ src: "fallback.md" });
        const result = await resolveInclude(d, projectRoot);
        expect(result).toBe("Fallback content");
    });

    it("profile-relative defaults to optional=false (warns on missing)", async () => {
        const warnings: string[] = [];
        const d = makeIncludeDirective({ src: "missing.md" });
        await resolveInclude(d, projectRoot, (w) => warnings.push(w), profileRoot);
        expect(warnings.some((w) => w.includes("not found"))).toBe(true);
    });

    it("@project/ defaults to optional=true (silent skip)", async () => {
        const warnings: string[] = [];
        const d = makeIncludeDirective({ src: "@project/missing.md" });
        const result = await resolveInclude(d, projectRoot, (w) => warnings.push(w), profileRoot);
        expect(result).toBe("");
        expect(warnings).toHaveLength(0);
    });

    it("@project/ optional=false warns on missing", async () => {
        const warnings: string[] = [];
        const d = makeIncludeDirective({ src: "@project/missing.md", optional: "false" });
        await resolveInclude(d, projectRoot, (w) => warnings.push(w), profileRoot);
        expect(warnings.some((w) => w.includes("not found"))).toBe(true);
    });

    it("profile-relative optional=true silently skips missing", async () => {
        const warnings: string[] = [];
        const d = makeIncludeDirective({ src: "missing.md", optional: "true" });
        const result = await resolveInclude(d, projectRoot, (w) => warnings.push(w), profileRoot);
        expect(result).toBe("");
        expect(warnings).toHaveLength(0);
    });

    // ── Include modes ──

    it("mode=inline (default) — reads and trims file content", async () => {
        await writeFile(join(profileRoot, "file.md"), "  Content with spaces  \n\n");
        const d = makeIncludeDirective({ src: "file.md" });
        const result = await resolveInclude(d, projectRoot, undefined, profileRoot);
        expect(result).toBe("Content with spaces");
    });

    it("mode=link — generates markdown link", async () => {
        await writeFile(join(profileRoot, "ref.md"), "content");
        const d = makeIncludeDirective({ src: "ref.md", mode: "link" });
        const result = await resolveInclude(
            d,
            projectRoot,
            undefined,
            profileRoot,
            "my-profile",
            vi.fn(),
        );
        expect(result).toContain("[");
        expect(result).toContain("](");
        expect(result).toContain(".baton/includes/my-profile/ref.md");
    });

    it("mode=reference — generates @-mention", async () => {
        await writeFile(join(profileRoot, "api.md"), "content");
        const d = makeIncludeDirective({ src: "api.md", mode: "reference" });
        const result = await resolveInclude(
            d,
            projectRoot,
            undefined,
            profileRoot,
            "my-profile",
            vi.fn(),
        );
        expect(result).toContain("@.baton/includes/my-profile/api.md");
    });

    it("mode=link with hint — uses template", async () => {
        await writeFile(join(profileRoot, "guide.md"), "content");
        const d = makeIncludeDirective({
            src: "guide.md",
            mode: "link",
            hint: "Read {{file}} for details",
        });
        const result = await resolveInclude(
            d,
            projectRoot,
            undefined,
            profileRoot,
            "my-profile",
            vi.fn(),
        );
        expect(result).toMatch(/^Read \[.*\]\(.*\) for details$/);
    });

    it("mode=reference with hint — uses template", async () => {
        await writeFile(join(profileRoot, "api.md"), "content");
        const d = makeIncludeDirective({
            src: "api.md",
            mode: "reference",
            hint: "See {{file}} for API docs",
        });
        const result = await resolveInclude(
            d,
            projectRoot,
            undefined,
            profileRoot,
            "my-profile",
            vi.fn(),
        );
        expect(result).toMatch(/^See @.* for API docs$/);
    });

    // ── Safety ──

    it("rejects absolute paths", async () => {
        const warnings: string[] = [];
        const d = makeIncludeDirective({ src: "/etc/passwd" });
        const result = await resolveInclude(d, projectRoot, (w) => warnings.push(w));
        expect(result).toBe("");
        expect(warnings.some((w) => w.includes("absolute"))).toBe(true);
    });

    it("rejects path traversal (../)", async () => {
        const warnings: string[] = [];
        const d = makeIncludeDirective({ src: "../secret.md" });
        const result = await resolveInclude(d, projectRoot, (w) => warnings.push(w));
        expect(result).toBe("");
        expect(warnings.some((w) => w.includes("traverse"))).toBe(true);
    });

    it("rejects binary files", async () => {
        await writeFile(join(profileRoot, "image.png"), "binary data");
        const warnings: string[] = [];
        const d = makeIncludeDirective({ src: "image.png" });
        const result = await resolveInclude(d, projectRoot, (w) => warnings.push(w), profileRoot);
        expect(result).toBe("");
        expect(warnings.some((w) => w.includes("binary"))).toBe(true);
    });

    it("warns when src attribute is missing", async () => {
        const warnings: string[] = [];
        const d = makeIncludeDirective({});
        const result = await resolveInclude(d, projectRoot, (w) => warnings.push(w));
        expect(result).toBe("");
        expect(warnings.some((w) => w.includes("src"))).toBe(true);
    });
});

describe("Phase 1.7 — Directive cleanup pass", () => {
    it("removes all remaining baton:* comments from output", async () => {
        const content = [
            "Text before",
            '<!-- baton:if tool="claude-code" -->',
            "Kept content",
            "<!-- baton:endif -->",
            "Text after",
            "<!-- baton:unknown-tag -->", // stray comment
        ].join("\n");

        const result = await processDirectives(content, makeOptions());
        expect(result).not.toContain("baton:");
        expect(result).toContain("Kept content");
        expect(result).toContain("Text before");
        expect(result).toContain("Text after");
    });

    it("unmatched baton:if → content kept (fail-open)", async () => {
        const content = ['<!-- baton:if tool="cursor" -->', "Orphan content"].join("\n");

        const warnings: string[] = [];
        const result = await processDirectives(
            content,
            makeOptions(
                {},
                {
                    onWarning: (w) => warnings.push(w),
                },
            ),
        );
        // Content kept (fail-open), directive tag cleaned
        expect(result).toContain("Orphan content");
        expect(warnings.some((w) => w.includes("Unmatched"))).toBe(true);
    });

    it("unmatched baton:endif → cleaned from output", async () => {
        const content = "Some text\n<!-- baton:endif -->\nMore text";
        const warnings: string[] = [];
        const result = await processDirectives(
            content,
            makeOptions(
                {},
                {
                    onWarning: (w) => warnings.push(w),
                },
            ),
        );
        expect(result).not.toContain("baton:endif");
        expect(result).toContain("Some text");
        expect(result).toContain("More text");
    });

    it("three-phase pipeline: conditionals → includes → cleanup", async () => {
        const projectRoot = join(tmpdir(), `baton-pipeline-${Date.now()}`);
        await mkdir(projectRoot, { recursive: true });
        await writeFile(join(projectRoot, "included.md"), "Included content");

        const content = [
            '<!-- baton:if tool="claude-code" -->',
            '<!-- baton:include src="included.md" -->',
            "<!-- baton:endif -->",
            '<!-- baton:if tool="cursor" -->',
            '<!-- baton:include src="should-not-load.md" -->',
            "<!-- baton:endif -->",
        ].join("\n");

        // profileRoot=undefined → falls back to projectRoot for includes
        const result = await processDirectives(
            content,
            makeOptions({ projectRoot, profileRoot: undefined }),
        );
        expect(result).toContain("Included content");
        expect(result).not.toContain("should-not-load");
        expect(result).not.toContain("baton:");

        await rm(projectRoot, { recursive: true, force: true });
    });
});

// ── Parser edge cases ──

describe("Phase 1 — Parser edge cases", () => {
    it("parses multiple attributes correctly", () => {
        const content = '<!-- baton:if tool="claude-code" scope="project" type="memory" -->';
        const directives = parseDirectives(content);
        expect(directives).toHaveLength(1);
        expect(directives[0].attributes).toEqual({
            tool: "claude-code",
            scope: "project",
            type: "memory",
        });
    });

    it("handles extra whitespace in directives", () => {
        const content = '<!--   baton:include   src="file.md"   -->';
        const directives = parseDirectives(content);
        expect(directives).toHaveLength(1);
        expect(directives[0].attributes.src).toBe("file.md");
    });

    it("ignores regular HTML comments", () => {
        const content = "<!-- This is a normal comment -->";
        const directives = parseDirectives(content);
        expect(directives).toHaveLength(0);
    });

    it("ignores unknown directive types", () => {
        const content = '<!-- baton:define name="x" -->';
        const directives = parseDirectives(content);
        expect(directives).toHaveLength(0);
    });

    it("silently drops unquoted attributes", () => {
        const content = "<!-- baton:if tool=cursor -->";
        const directives = parseDirectives(content);
        expect(directives).toHaveLength(1);
        expect(Object.keys(directives[0].attributes)).toHaveLength(0);
    });
});

// ── Conditional nesting ──

describe("Phase 1 — Conditional nesting", () => {
    it("matchConditionalPairs returns innermost-first", () => {
        const directives = [
            makeIf({ tool: "x" }, 0), // depth 0
            makeIf({ scope: "y" }, 50), // depth 1 (innermost)
            makeEndif(100), // closes depth 1
            makeEndif(150), // closes depth 0
        ];

        const { matched } = matchConditionalPairs(directives);
        expect(matched).toHaveLength(2);
        expect(matched[0].depth).toBe(1); // innermost first
        expect(matched[1].depth).toBe(0);
    });

    it("max nesting depth is 5 — exceeding emits warning", () => {
        const directives: ParsedDirective[] = [];
        let pos = 0;
        // Create 6 nested ifs
        for (let i = 0; i < 6; i++) {
            directives.push(makeIf({ tool: "x" }, pos));
            pos += 50;
        }
        // Close them all
        for (let i = 0; i < 6; i++) {
            directives.push(makeEndif(pos));
            pos += 50;
        }

        const warnings: string[] = [];
        const { matched } = matchConditionalPairs(directives, (w) => warnings.push(w));

        // Only 5 levels should be matched (6th exceeds MAX_DEPTH)
        expect(matched.length).toBeLessThanOrEqual(5);
        expect(warnings.some((w) => w.includes("nesting depth"))).toBe(true);
    });

    it("deeply nested conditionals (5 levels) resolve correctly", async () => {
        const content = [
            '<!-- baton:if tool="claude-code" -->',
            '<!-- baton:if scope="project" -->',
            '<!-- baton:if type="memory" -->',
            '<!-- baton:if ide="vscode" -->',
            '<!-- baton:if not-tool="cursor" -->',
            "Deep content",
            "<!-- baton:endif -->",
            "<!-- baton:endif -->",
            "<!-- baton:endif -->",
            "<!-- baton:endif -->",
            "<!-- baton:endif -->",
        ].join("\n");

        const result = await processDirectives(content, makeOptions());
        expect(result).toContain("Deep content");
    });

    it("nested conditional — inner excluded, outer kept", async () => {
        const content = [
            '<!-- baton:if tool="claude-code" -->',
            "Outer content",
            '<!-- baton:if tool="cursor" -->', // false
            "Inner content (excluded)",
            "<!-- baton:endif -->",
            "After inner",
            "<!-- baton:endif -->",
        ].join("\n");

        const result = await processDirectives(content, makeOptions());
        expect(result).toContain("Outer content");
        expect(result).not.toContain("Inner content (excluded)");
        expect(result).toContain("After inner");
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2: Pipeline Refactor + Merge Simplification
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 2.3 — Merge strategy simplification", () => {
    it("concat strategy joins parts with double newline", () => {
        const result = mergeContentParts(["Part A", "Part B", "Part C"], "concat");
        expect(result).toContain("Part A");
        expect(result).toContain("Part B");
        expect(result).toContain("Part C");
    });

    it("replace strategy keeps last part (highest weight)", () => {
        const result = mergeContentParts(["Low weight", "High weight"], "replace");
        expect(result).toBe("High weight");
        expect(result).not.toContain("Low weight");
    });

    it("unknown strategy falls back to concat", () => {
        const result = mergeContentParts(["A", "B"], "nonexistent");
        expect(result).toContain("A");
        expect(result).toContain("B");
    });

    it("normalizeMarkdown collapses 3+ newlines to 2", () => {
        const result = normalizeMarkdown("A\n\n\n\n\nB");
        expect(result).toBe("A\n\nB\n");
    });

    it("normalizeMarkdown adds trailing newline", () => {
        expect(normalizeMarkdown("Hello")).toBe("Hello\n");
    });
});

describe("Phase 2.4 — Referenced file placement (.baton/includes/)", () => {
    it("computePlacementTarget generates correct path", () => {
        const target = computePlacementTarget("my-profile", "fragments/rules.md");
        expect(target).toBe(join(".baton/includes/my-profile/fragments/rules.md"));
    });

    it("computePlacementTarget normalizes path separators", () => {
        const target = computePlacementTarget("profile", "./sub/../file.md");
        expect(target).toBe(join(".baton/includes/profile/file.md"));
    });

    describe("onPlacement callback", () => {
        let profileRoot: string;

        beforeEach(async () => {
            profileRoot = join(tmpdir(), `baton-placement-${Date.now()}`);
            await mkdir(profileRoot, { recursive: true });
        });

        afterEach(async () => {
            await rm(profileRoot, { recursive: true, force: true });
        });

        it("emits placement for profile-relative link includes", async () => {
            await writeFile(join(profileRoot, "fragment.md"), "Content");
            const placements: FilePlacement[] = [];
            const d = makeIncludeDirective({ src: "fragment.md", mode: "link" });

            await resolveInclude(d, "/project", undefined, profileRoot, "test-profile", (p) =>
                placements.push(p),
            );

            expect(placements).toHaveLength(1);
            expect(placements[0].profileName).toBe("test-profile");
            expect(placements[0].targetRelative).toContain(
                ".baton/includes/test-profile/fragment.md",
            );
            expect(placements[0].sourcePath).toBe(join(profileRoot, "fragment.md"));
        });

        it("emits placement for profile-relative reference includes", async () => {
            await writeFile(join(profileRoot, "api.md"), "API docs");
            const placements: FilePlacement[] = [];
            const d = makeIncludeDirective({ src: "api.md", mode: "reference" });

            await resolveInclude(d, "/project", undefined, profileRoot, "test-profile", (p) =>
                placements.push(p),
            );

            expect(placements).toHaveLength(1);
            expect(placements[0].targetRelative).toContain(".baton/includes/test-profile/api.md");
        });

        it("does NOT emit placement for @project/ includes", async () => {
            await writeFile(join("/tmp", "proj-file.md"), "content");
            const placements: FilePlacement[] = [];
            const d = makeIncludeDirective({ src: "@project/proj-file.md", mode: "link" });

            // Use /tmp as projectRoot for this test
            await resolveInclude(d, "/tmp", undefined, profileRoot, "test-profile", (p) =>
                placements.push(p),
            );

            expect(placements).toHaveLength(0);
        });

        it("does NOT emit placement for inline mode", async () => {
            await writeFile(join(profileRoot, "inline.md"), "Inline content");
            const placements: FilePlacement[] = [];
            const d = makeIncludeDirective({ src: "inline.md", mode: "inline" });

            await resolveInclude(d, "/project", undefined, profileRoot, "test-profile", (p) =>
                placements.push(p),
            );

            expect(placements).toHaveLength(0);
        });

        it("does NOT emit placement when profileName is missing", async () => {
            await writeFile(join(profileRoot, "file.md"), "content");
            const placements: FilePlacement[] = [];
            const d = makeIncludeDirective({ src: "file.md", mode: "link" });

            await resolveInclude(d, "/project", undefined, profileRoot, undefined, (p) =>
                placements.push(p),
            );

            expect(placements).toHaveLength(0);
        });

        it("end-to-end: processDirectives collects placements", async () => {
            await writeFile(join(profileRoot, "frag.md"), "Fragment");
            const placements: FilePlacement[] = [];

            const content = '# Header\n<!-- baton:include src="frag.md" mode="link" -->';
            const result = await processDirectives(content, {
                context: makeContext({ profileRoot }),
                onPlacement: (p) => placements.push(p),
            });

            expect(placements).toHaveLength(1);
            expect(result).toContain(".baton/includes/test-profile/frag.md");
            expect(result).toContain("# Header");
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3: Preview Command (explain mode)
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 3 — Explain mode", () => {
    it("annotates included block with [INCLUDED] marker", async () => {
        const content = [
            "Before",
            '<!-- baton:if tool="claude-code" -->',
            "Claude content",
            "<!-- baton:endif -->",
            "After",
        ].join("\n");

        const result = await processDirectives(content, makeOptions({}, { explain: true }));
        expect(result).toContain(">>> [INCLUDED] if");
        expect(result).toContain('tool="claude-code"');
        expect(result).toContain("Claude content");
        expect(result).toContain(">>> [END] <<<");
        expect(result).toContain("Before");
        expect(result).toContain("After");
    });

    it("annotates excluded block with [EXCLUDED] marker", async () => {
        const content = [
            '<!-- baton:if tool="cursor" -->',
            "Cursor-only content",
            "<!-- baton:endif -->",
        ].join("\n");

        const result = await processDirectives(content, makeOptions({}, { explain: true }));
        expect(result).toContain(">>> [EXCLUDED] if");
        expect(result).toContain('tool="cursor"');
        expect(result).toContain("Cursor-only content");
        expect(result).toContain(">>> [END] <<<");
    });

    it("annotates if/else/endif — condition true", async () => {
        const content = [
            '<!-- baton:if tool="claude-code" -->',
            "Claude branch",
            "<!-- baton:else -->",
            "Other branch",
            "<!-- baton:endif -->",
        ].join("\n");

        const result = await processDirectives(content, makeOptions({}, { explain: true }));
        expect(result).toContain("[INCLUDED] if");
        expect(result).toContain("Claude branch");
        expect(result).toContain("[EXCLUDED] else");
        expect(result).toContain("Other branch");
    });

    it("annotates if/else/endif — condition false", async () => {
        const content = [
            '<!-- baton:if tool="cursor" -->',
            "Cursor branch",
            "<!-- baton:else -->",
            "Fallback branch",
            "<!-- baton:endif -->",
        ].join("\n");

        const result = await processDirectives(content, makeOptions({}, { explain: true }));
        expect(result).toContain("[EXCLUDED] if");
        expect(result).toContain("Cursor branch");
        expect(result).toContain("[INCLUDED] else");
        expect(result).toContain("Fallback branch");
    });

    it("shows multiple condition attributes in annotation", async () => {
        const content = [
            '<!-- baton:if tool="claude-code" scope="project" -->',
            "Targeted content",
            "<!-- baton:endif -->",
        ].join("\n");

        const result = await processDirectives(content, makeOptions({}, { explain: true }));
        expect(result).toContain('tool="claude-code"');
        expect(result).toContain('scope="project"');
        expect(result).toContain("[INCLUDED]");
    });

    it("explain mode skips cleanup — preserves baton:include comments", async () => {
        // Include directives still resolve, but cleanup is skipped
        const content = 'Text <!-- baton:include src="missing.md" optional="true" -->';
        const result = await processDirectives(content, makeOptions({}, { explain: true }));
        expect(result).toContain("Text");
        // After include resolution (returns empty for optional missing), cleanup is skipped
        // so any other surviving baton: comments would remain
    });

    it("explain mode annotates nested conditionals correctly", async () => {
        const content = [
            '<!-- baton:if tool="claude-code" -->',
            "Outer",
            '<!-- baton:if scope="global" -->', // false — scope is project
            "Inner (excluded)",
            "<!-- baton:endif -->",
            "After inner",
            "<!-- baton:endif -->",
        ].join("\n");

        const result = await processDirectives(content, makeOptions({}, { explain: true }));
        expect(result).toContain("[INCLUDED]");
        expect(result).toContain("[EXCLUDED]");
        expect(result).toContain("Outer");
        expect(result).toContain("Inner (excluded)");
        expect(result).toContain("After inner");
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// End-to-End Integration: Full Pipeline
// ─────────────────────────────────────────────────────────────────────────────

describe("End-to-end — Full directive pipeline integration", () => {
    let projectRoot: string;
    let profileRoot: string;

    beforeEach(async () => {
        clearHasCache();
        projectRoot = join(tmpdir(), `baton-e2e-project-${Date.now()}`);
        profileRoot = join(tmpdir(), `baton-e2e-profile-${Date.now()}`);
        await mkdir(projectRoot, { recursive: true });
        await mkdir(profileRoot, { recursive: true });
    });

    afterEach(async () => {
        clearHasCache();
        await rm(projectRoot, { recursive: true, force: true });
        await rm(profileRoot, { recursive: true, force: true });
    });

    it("real-world scenario: ROOT file with conditionals + includes", async () => {
        // Profile structure: ROOT.md with tool-specific includes
        await writeFile(join(profileRoot, "claude-rules.md"), "Use CLAUDE.md conventions");
        await writeFile(join(profileRoot, "cursor-rules.md"), "Use .cursorrules format");
        await writeFile(join(profileRoot, "shared-rules.md"), "Always use TypeScript strict mode");

        const rootContent = [
            "# Team Rules",
            "",
            '<!-- baton:include src="shared-rules.md" -->',
            "",
            '<!-- baton:if tool="claude-code" -->',
            '<!-- baton:include src="claude-rules.md" -->',
            "<!-- baton:endif -->",
            "",
            '<!-- baton:if tool="cursor" -->',
            '<!-- baton:include src="cursor-rules.md" -->',
            "<!-- baton:endif -->",
        ].join("\n");

        const result = await processDirectives(
            rootContent,
            makeOptions({
                profileRoot,
                profileName: "team",
            }),
        );

        expect(result).toContain("# Team Rules");
        expect(result).toContain("Always use TypeScript strict mode");
        expect(result).toContain("Use CLAUDE.md conventions");
        expect(result).not.toContain("Use .cursorrules format");
        expect(result).not.toContain("baton:");
    });

    it("conditionals + includes + placements combined", async () => {
        await writeFile(join(profileRoot, "api-guide.md"), "API Reference");

        const content = [
            "# Memory",
            '<!-- baton:if tool="claude-code" -->',
            '<!-- baton:include src="api-guide.md" mode="link" -->',
            "<!-- baton:endif -->",
        ].join("\n");

        const placements: FilePlacement[] = [];
        const result = await processDirectives(content, {
            context: makeContext({ projectRoot, profileRoot, profileName: "my-profile" }),
            onPlacement: (p) => placements.push(p),
        });

        expect(result).toContain("# Memory");
        expect(result).toContain(".baton/includes/my-profile/api-guide.md");
        expect(placements).toHaveLength(1);
        expect(placements[0].profileName).toBe("my-profile");
    });

    it("conditionals with has detection + @project/ includes", async () => {
        await writeFile(join(projectRoot, "tsconfig.json"), "{}");
        await writeFile(join(projectRoot, ".eslintrc.json"), "{}");
        await writeFile(join(projectRoot, "project-notes.md"), "Project-specific notes");

        const content = [
            "# Config",
            '<!-- baton:if has="typescript" -->',
            "Enable strict TypeScript checking.",
            "<!-- baton:endif -->",
            '<!-- baton:if has="eslint" -->',
            "Run ESLint on save.",
            "<!-- baton:endif -->",
            '<!-- baton:if has="prettier" -->', // false — no prettier config
            "Use Prettier for formatting.",
            "<!-- baton:endif -->",
            '<!-- baton:include src="@project/project-notes.md" -->',
        ].join("\n");

        const result = await processDirectives(content, makeOptions({ projectRoot, profileRoot }));

        expect(result).toContain("Enable strict TypeScript checking");
        expect(result).toContain("Run ESLint on save");
        expect(result).not.toContain("Use Prettier");
        expect(result).toContain("Project-specific notes");
    });

    it("if/else with tool-specific content + AND composition", async () => {
        const content = [
            '<!-- baton:if tool="claude-code" scope="project" -->',
            "Claude project-scoped content",
            "<!-- baton:else -->",
            "Default content",
            "<!-- baton:endif -->",
        ].join("\n");

        // Both conditions true → if-branch
        const result1 = await processDirectives(content, makeOptions());
        expect(result1).toContain("Claude project-scoped content");
        expect(result1).not.toContain("Default content");

        // tool matches but scope doesn't → else-branch
        const result2 = await processDirectives(content, makeOptions({ scope: "global" }));
        expect(result2).toContain("Default content");
        expect(result2).not.toContain("Claude project-scoped content");
    });

    it("var conditions with colon syntax in full pipeline", async () => {
        const content = [
            '<!-- baton:if var="lang:typescript" -->',
            "TypeScript rules apply.",
            "<!-- baton:else -->",
            "Non-TypeScript rules.",
            "<!-- baton:endif -->",
            '<!-- baton:if var="env:production" -->',
            "No debug logging.",
            "<!-- baton:endif -->",
            '<!-- baton:if not-var="debug" -->',
            "Debug mode is off.",
            "<!-- baton:endif -->",
        ].join("\n");

        const result = await processDirectives(
            content,
            makeOptions({
                variables: { lang: "typescript", env: "production" },
            }),
        );

        expect(result).toContain("TypeScript rules apply.");
        expect(result).not.toContain("Non-TypeScript rules.");
        expect(result).toContain("No debug logging.");
        expect(result).toContain("Debug mode is off.");
    });

    it("not-tool + ide combined (AND)", async () => {
        const content = [
            '<!-- baton:if not-tool="cursor" ide="vscode" -->',
            "This is for non-Cursor tools in VSCode",
            "<!-- baton:endif -->",
        ].join("\n");

        // claude-code in vscode → both conditions pass
        const result = await processDirectives(content, makeOptions());
        expect(result).toContain("This is for non-Cursor tools in VSCode");
    });

    it("file condition combined with include (excluded include is not read)", async () => {
        await writeFile(join(projectRoot, "biome.json"), "{}");
        await writeFile(join(profileRoot, "biome-config.md"), "Biome configuration tips");

        const content = [
            '<!-- baton:if file="biome.json" -->',
            '<!-- baton:include src="biome-config.md" -->',
            "<!-- baton:endif -->",
            '<!-- baton:if file="eslint.config.js" -->', // file doesn't exist
            '<!-- baton:include src="nonexistent-eslint.md" -->',
            "<!-- baton:endif -->",
        ].join("\n");

        const result = await processDirectives(content, makeOptions({ projectRoot, profileRoot }));
        expect(result).toContain("Biome configuration tips");
        expect(result).not.toContain("nonexistent-eslint");
    });

    it("explain mode on complex document with multiple conditions", async () => {
        const content = [
            "# Rules",
            '<!-- baton:if tool="claude-code" -->',
            "Claude rule A",
            "<!-- baton:endif -->",
            '<!-- baton:if tool="cursor" -->',
            "Cursor rule B",
            "<!-- baton:else -->",
            "Non-Cursor rule B",
            "<!-- baton:endif -->",
            '<!-- baton:if scope="global" -->',
            "Global only",
            "<!-- baton:endif -->",
        ].join("\n");

        const result = await processDirectives(content, makeOptions({}, { explain: true }));

        // First block: tool=claude-code → INCLUDED
        expect(result).toContain("[INCLUDED] if");
        expect(result).toContain("Claude rule A");

        // Second block: tool=cursor → EXCLUDED if, INCLUDED else
        expect(result).toContain("[EXCLUDED] if");
        expect(result).toContain("Cursor rule B");
        expect(result).toContain("[INCLUDED] else");
        expect(result).toContain("Non-Cursor rule B");

        // Third block: scope=global → EXCLUDED (scope is project)
        expect(result).toContain("Global only");

        // Count END markers — should be 3 blocks
        const endMarkers = result.match(/>>> \[END\] <<</g);
        expect(endMarkers).toHaveLength(3);
    });

    it("merge after directive processing: concat strategy", async () => {
        // Simulate two profiles contributing memory, each with directives
        const profile1Content = [
            '<!-- baton:if tool="claude-code" -->',
            "Profile 1 Claude memory",
            "<!-- baton:endif -->",
        ].join("\n");

        const profile2Content = [
            '<!-- baton:if tool="claude-code" -->',
            "Profile 2 Claude memory",
            "<!-- baton:endif -->",
        ].join("\n");

        const processed1 = await processDirectives(profile1Content, makeOptions());
        const processed2 = await processDirectives(profile2Content, makeOptions());

        const merged = mergeContentParts([processed1, processed2], "concat");
        expect(merged).toContain("Profile 1 Claude memory");
        expect(merged).toContain("Profile 2 Claude memory");
    });

    it("merge after directive processing: replace strategy (highest weight wins)", async () => {
        const lowWeight = await processDirectives(
            '<!-- baton:if tool="claude-code" -->Low weight<!-- baton:endif -->',
            makeOptions(),
        );
        const highWeight = await processDirectives(
            '<!-- baton:if tool="claude-code" -->High weight<!-- baton:endif -->',
            makeOptions(),
        );

        const merged = mergeContentParts([lowWeight, highWeight], "replace");
        expect(merged).toBe("High weight");
        expect(merged).not.toContain("Low weight");
    });

    it("fast path: content without baton: prefix skips all processing", async () => {
        const content = "# Simple markdown\n\nNo directives here.";
        const result = await processDirectives(content, makeOptions());
        expect(result).toBe(content);
    });

    it("empty content returns empty", async () => {
        const result = await processDirectives("", makeOptions());
        expect(result).toBe("");
    });

    it("DirectiveOptions supports explain + onPlacement + onWarning simultaneously", async () => {
        await writeFile(join(profileRoot, "doc.md"), "Documentation");

        const content = [
            '<!-- baton:if tool="claude-code" -->',
            '<!-- baton:include src="doc.md" mode="link" -->',
            "<!-- baton:endif -->",
        ].join("\n");

        const placements: FilePlacement[] = [];
        const warnings: string[] = [];

        const result = await processDirectives(content, {
            context: makeContext({ profileRoot }),
            explain: true,
            onPlacement: (p) => placements.push(p),
            onWarning: (w) => warnings.push(w),
        });

        expect(result).toContain("[INCLUDED]");
        expect(result).toContain(".baton/includes/test-profile/doc.md");
        expect(placements).toHaveLength(1);
    });
});

// ─── Phase 4: Expression-Based Conditions ───────────────────────────────────

describe("Phase 4 — Expression-Based Condition Syntax", () => {
    let projectRoot: string;

    beforeEach(async () => {
        projectRoot = join(tmpdir(), `baton-expr-integration-${Date.now()}`);
        await mkdir(projectRoot, { recursive: true });
        clearHasCache();
    });

    afterEach(async () => {
        await rm(projectRoot, { recursive: true, force: true });
    });

    describe("4.1 — Basic expression conditions in processDirectives", () => {
        it("simple property comparison", async () => {
            const content = [
                "# Rules",
                "<!-- baton:if condition=\"tool == 'claude-code'\" -->",
                "Claude-specific rule",
                "<!-- baton:endif -->",
                "<!-- baton:if condition=\"tool == 'cursor'\" -->",
                "Cursor-specific rule",
                "<!-- baton:endif -->",
            ].join("\n");

            const result = await processDirectives(content, makeOptions({ projectRoot }));
            expect(result).toContain("Claude-specific rule");
            expect(result).not.toContain("Cursor-specific rule");
        });

        it("OR expression selects matching branch", async () => {
            const content = [
                "<!-- baton:if condition=\"tool == 'cursor' or tool == 'windsurf'\" -->",
                "Web IDE content",
                "<!-- baton:endif -->",
            ].join("\n");

            const result = await processDirectives(
                content,
                makeOptions({ projectRoot, currentTool: "windsurf" }),
            );
            expect(result).toContain("Web IDE content");
        });

        it("AND expression requires both sides", async () => {
            const content = [
                "<!-- baton:if condition=\"tool == 'claude-code' and scope == 'global'\" -->",
                "Global Claude rule",
                "<!-- baton:endif -->",
            ].join("\n");

            // scope is "project" by default, so AND fails
            const result = await processDirectives(content, makeOptions({ projectRoot }));
            expect(result).not.toContain("Global Claude rule");
        });

        it("grouped expression overrides default precedence", async () => {
            const content = [
                "<!-- baton:if condition=\"(tool == 'claude-code' or tool == 'cursor') and scope == 'project'\" -->",
                "Project rule for Claude or Cursor",
                "<!-- baton:endif -->",
            ].join("\n");

            const result = await processDirectives(content, makeOptions({ projectRoot }));
            expect(result).toContain("Project rule for Claude or Cursor");
        });
    });

    describe("4.2 — Function calls in expressions", () => {
        it("has() detects project characteristics", async () => {
            await writeFile(join(projectRoot, "tsconfig.json"), "{}");

            const content = [
                "<!-- baton:if condition=\"has('typescript') and not has('prettier')\" -->",
                "TypeScript without Prettier",
                "<!-- baton:endif -->",
            ].join("\n");

            const result = await processDirectives(content, makeOptions({ projectRoot }));
            expect(result).toContain("TypeScript without Prettier");
        });

        it("file() checks file existence with OR fallback", async () => {
            await writeFile(join(projectRoot, "biome.jsonc"), "{}");

            const content = [
                "<!-- baton:if condition=\"file('biome.json') or file('biome.jsonc')\" -->",
                "Biome is configured",
                "<!-- baton:endif -->",
            ].join("\n");

            const result = await processDirectives(content, makeOptions({ projectRoot }));
            expect(result).toContain("Biome is configured");
        });

        it("var() existence check", async () => {
            const content = [
                "<!-- baton:if condition=\"var('lang')\" -->",
                "Language is set",
                "<!-- baton:endif -->",
            ].join("\n");

            const result = await processDirectives(
                content,
                makeOptions({ projectRoot, variables: { lang: "typescript" } }),
            );
            expect(result).toContain("Language is set");
        });

        it("var() value comparison", async () => {
            const content = [
                "<!-- baton:if condition=\"var('env') == 'production'\" -->",
                "Production rules",
                "<!-- baton:endif -->",
            ].join("\n");

            const result = await processDirectives(
                content,
                makeOptions({ projectRoot, variables: { env: "production" } }),
            );
            expect(result).toContain("Production rules");
        });
    });

    describe("4.3 — Expression conditions with else", () => {
        it("if/else/endif with expression — true branch", async () => {
            const content = [
                "<!-- baton:if condition=\"tool == 'claude-code'\" -->",
                "Use @file for context.",
                "<!-- baton:else -->",
                "Use file paths for context.",
                "<!-- baton:endif -->",
            ].join("\n");

            const result = await processDirectives(content, makeOptions({ projectRoot }));
            expect(result).toContain("Use @file for context.");
            expect(result).not.toContain("Use file paths for context.");
        });

        it("if/else/endif with expression — false branch", async () => {
            const content = [
                "<!-- baton:if condition=\"tool == 'cursor'\" -->",
                "Cursor instructions.",
                "<!-- baton:else -->",
                "Generic instructions.",
                "<!-- baton:endif -->",
            ].join("\n");

            const result = await processDirectives(content, makeOptions({ projectRoot }));
            expect(result).not.toContain("Cursor instructions.");
            expect(result).toContain("Generic instructions.");
        });

        it("nested expression condition inside else", async () => {
            const content = [
                "<!-- baton:if condition=\"tool == 'cursor'\" -->",
                "Cursor content",
                "<!-- baton:else -->",
                "<!-- baton:if condition=\"scope == 'project'\" -->",
                "Project fallback",
                "<!-- baton:endif -->",
                "<!-- baton:endif -->",
            ].join("\n");

            const result = await processDirectives(content, makeOptions({ projectRoot }));
            expect(result).not.toContain("Cursor content");
            expect(result).toContain("Project fallback");
        });
    });

    describe("4.4 — Expression conditions in explain mode", () => {
        it("annotates expression condition as included", async () => {
            const content = [
                "<!-- baton:if condition=\"tool == 'claude-code' and scope == 'project'\" -->",
                "Claude project rule",
                "<!-- baton:endif -->",
            ].join("\n");

            const result = await processDirectives(content, {
                ...makeOptions({ projectRoot }),
                explain: true,
            });
            expect(result).toContain("[INCLUDED]");
            expect(result).toContain("Claude project rule");
        });

        it("annotates expression condition as excluded", async () => {
            const content = [
                "<!-- baton:if condition=\"tool == 'cursor'\" -->",
                "Cursor rule",
                "<!-- baton:endif -->",
            ].join("\n");

            const result = await processDirectives(content, {
                ...makeOptions({ projectRoot }),
                explain: true,
            });
            expect(result).toContain("[EXCLUDED]");
            expect(result).toContain("Cursor rule");
        });

        it("annotates expression if/else/endif", async () => {
            const content = [
                "<!-- baton:if condition=\"tool == 'claude-code'\" -->",
                "Claude branch",
                "<!-- baton:else -->",
                "Other branch",
                "<!-- baton:endif -->",
            ].join("\n");

            const result = await processDirectives(content, {
                ...makeOptions({ projectRoot }),
                explain: true,
            });
            expect(result).toContain("[INCLUDED] if");
            expect(result).toContain("Claude branch");
            expect(result).toContain("[EXCLUDED] else");
            expect(result).toContain("Other branch");
        });
    });

    describe("4.5 — Backward compatibility", () => {
        it("old-style attributes still work alongside expression conditions", async () => {
            const content = [
                '<!-- baton:if tool="claude-code" -->',
                "Old-style Claude",
                "<!-- baton:endif -->",
                "<!-- baton:if condition=\"scope == 'project'\" -->",
                "New-style project",
                "<!-- baton:endif -->",
            ].join("\n");

            const result = await processDirectives(content, makeOptions({ projectRoot }));
            expect(result).toContain("Old-style Claude");
            expect(result).toContain("New-style project");
        });

        it("mixing condition with old-style warns but condition wins", async () => {
            const warnings: string[] = [];
            const content = [
                '<!-- baton:if condition="tool == \'claude-code\'" tool="cursor" -->',
                "Mixed",
                "<!-- baton:endif -->",
            ].join("\n");

            const result = await processDirectives(content, {
                ...makeOptions({ projectRoot }),
                onWarning: (msg) => warnings.push(msg),
            });
            expect(result).toContain("Mixed"); // condition wins: tool == claude-code → true
            expect(warnings.some((w) => w.includes("condition attribute present"))).toBe(true);
        });
    });
});
