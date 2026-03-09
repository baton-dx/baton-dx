import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveInclude } from "./include.js";
import type { ParsedDirective } from "./types.js";

function makeInclude(attrs: Record<string, string>): ParsedDirective {
    return { type: "include", attributes: attrs, startIndex: 0, endIndex: 10, raw: "" };
}

describe("resolveInclude", () => {
    let projectRoot: string;

    beforeEach(async () => {
        projectRoot = join(tmpdir(), `baton-include-test-${Date.now()}`);
        await mkdir(projectRoot, { recursive: true });
    });

    afterEach(async () => {
        await rm(projectRoot, { recursive: true, force: true });
    });

    it('mode="inline" inlines file content', async () => {
        await writeFile(join(projectRoot, "PROJECT.md"), "# My Project\nDetails here.");
        const result = await resolveInclude(
            makeInclude({ src: "PROJECT.md", mode: "inline" }),
            projectRoot,
        );
        expect(result).toBe("# My Project\nDetails here.");
    });

    it("default mode is inline", async () => {
        await writeFile(join(projectRoot, "file.md"), "content");
        const result = await resolveInclude(makeInclude({ src: "file.md" }), projectRoot);
        expect(result).toBe("content");
    });

    it('mode="link" generates markdown link', async () => {
        await writeFile(join(projectRoot, "api.md"), "API docs");
        const result = await resolveInclude(
            makeInclude({ src: "api.md", mode: "link" }),
            projectRoot,
        );
        expect(result).toBe("[api.md](api.md)");
    });

    it('mode="link" with hint uses template', async () => {
        await writeFile(join(projectRoot, "api.md"), "API docs");
        const result = await resolveInclude(
            makeInclude({ src: "api.md", mode: "link", hint: "See {{file}} for details" }),
            projectRoot,
        );
        expect(result).toBe("See [api.md](api.md) for details");
    });

    it('mode="reference" generates @-mention', async () => {
        await writeFile(join(projectRoot, "api.md"), "API docs");
        const result = await resolveInclude(
            makeInclude({ src: "api.md", mode: "reference" }),
            projectRoot,
        );
        expect(result).toBe("See @api.md for additional context.");
    });

    it('mode="reference" with hint uses template', async () => {
        await writeFile(join(projectRoot, "api.md"), "API docs");
        const result = await resolveInclude(
            makeInclude({ src: "api.md", mode: "reference", hint: "Read {{file}} for API docs" }),
            projectRoot,
        );
        expect(result).toBe("Read @api.md for API docs");
    });

    it("hint is ignored for inline mode", async () => {
        await writeFile(join(projectRoot, "file.md"), "content");
        const result = await resolveInclude(
            makeInclude({ src: "file.md", mode: "inline", hint: "This {{file}} hint is ignored" }),
            projectRoot,
        );
        expect(result).toBe("content");
    });

    it('optional="true" silently skips missing files', async () => {
        const warn = vi.fn();
        const result = await resolveInclude(
            makeInclude({ src: "missing.md", optional: "true" }),
            projectRoot,
            warn,
        );
        expect(result).toBe("");
        expect(warn).not.toHaveBeenCalled();
    });

    it("missing file without optional → warning + not-found comment", async () => {
        const warn = vi.fn();
        const result = await resolveInclude(makeInclude({ src: "missing.md" }), projectRoot, warn);
        expect(result).toContain("file not found");
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("file not found"));
    });

    it("rejects path traversal (../)", async () => {
        const warn = vi.fn();
        const result = await resolveInclude(
            makeInclude({ src: "../secret.md" }),
            projectRoot,
            warn,
        );
        expect(result).toBe("");
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("traverse outside project root"));
    });

    it("rejects absolute paths", async () => {
        const warn = vi.fn();
        const result = await resolveInclude(makeInclude({ src: "/etc/passwd" }), projectRoot, warn);
        expect(result).toBe("");
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("must be relative"));
    });

    it("warns on binary file", async () => {
        await writeFile(join(projectRoot, "image.png"), "fake png");
        const warn = vi.fn();
        const result = await resolveInclude(makeInclude({ src: "image.png" }), projectRoot, warn);
        expect(result).toBe("");
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("binary file"));
    });

    it("handles empty file → returns empty string", async () => {
        await writeFile(join(projectRoot, "empty.md"), "");
        const result = await resolveInclude(makeInclude({ src: "empty.md" }), projectRoot);
        expect(result).toBe("");
    });

    it("handles deep paths", async () => {
        await mkdir(join(projectRoot, "docs", "api"), { recursive: true });
        await writeFile(join(projectRoot, "docs", "api", "overview.md"), "API overview");
        const result = await resolveInclude(
            makeInclude({ src: "docs/api/overview.md" }),
            projectRoot,
        );
        expect(result).toBe("API overview");
    });

    it("warns when src attribute is missing", async () => {
        const warn = vi.fn();
        const result = await resolveInclude(makeInclude({}), projectRoot, warn);
        expect(result).toBe("");
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("missing required src"));
    });
});
