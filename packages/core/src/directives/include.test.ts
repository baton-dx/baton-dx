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

    it("inline mode trims leading/trailing whitespace", async () => {
        await writeFile(join(projectRoot, "padded.md"), "\n\n  Actual content\n\n");
        const result = await resolveInclude(makeInclude({ src: "padded.md" }), projectRoot);
        expect(result).toBe("Actual content");
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

    it("missing file without optional → warning + empty string", async () => {
        const warn = vi.fn();
        const result = await resolveInclude(makeInclude({ src: "missing.md" }), projectRoot, warn);
        expect(result).toBe("");
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
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("traverse outside root"));
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

    describe("dual-root resolution", () => {
        let profileRoot: string;

        beforeEach(async () => {
            profileRoot = join(tmpdir(), `baton-include-profile-${Date.now()}`);
            await mkdir(join(profileRoot, "fragments"), { recursive: true });
        });

        afterEach(async () => {
            await rm(profileRoot, { recursive: true, force: true });
        });

        it("resolves relative to profileRoot when available", async () => {
            await writeFile(join(profileRoot, "fragments", "ts.md"), "TypeScript rules");
            const result = await resolveInclude(
                makeInclude({ src: "fragments/ts.md" }),
                projectRoot,
                undefined,
                profileRoot,
            );
            expect(result).toBe("TypeScript rules");
        });

        it("@project/ prefix resolves relative to projectRoot", async () => {
            await writeFile(join(projectRoot, "README.md"), "Project readme");
            const result = await resolveInclude(
                makeInclude({ src: "@project/README.md" }),
                projectRoot,
                undefined,
                profileRoot,
            );
            expect(result).toBe("Project readme");
        });

        it("profile-relative defaults to optional=false (warns on missing)", async () => {
            const warn = vi.fn();
            const result = await resolveInclude(
                makeInclude({ src: "fragments/missing.md" }),
                projectRoot,
                warn,
                profileRoot,
            );
            expect(result).toBe("");
            expect(warn).toHaveBeenCalledWith(expect.stringContaining("file not found"));
        });

        it("@project/ defaults to optional=true (silent skip on missing)", async () => {
            const warn = vi.fn();
            const result = await resolveInclude(
                makeInclude({ src: "@project/NONEXISTENT.md" }),
                projectRoot,
                warn,
                profileRoot,
            );
            expect(result).toBe("");
            expect(warn).not.toHaveBeenCalled();
        });

        it('@project/ optional="false" warns on missing', async () => {
            const warn = vi.fn();
            const result = await resolveInclude(
                makeInclude({ src: "@project/NONEXISTENT.md", optional: "false" }),
                projectRoot,
                warn,
                profileRoot,
            );
            expect(result).toBe("");
            expect(warn).toHaveBeenCalledWith(expect.stringContaining("file not found"));
        });

        it('profile-relative optional="true" silently skips missing', async () => {
            const warn = vi.fn();
            const result = await resolveInclude(
                makeInclude({ src: "fragments/missing.md", optional: "true" }),
                projectRoot,
                warn,
                profileRoot,
            );
            expect(result).toBe("");
            expect(warn).not.toHaveBeenCalled();
        });

        it("falls back to projectRoot when no profileRoot provided", async () => {
            await writeFile(join(projectRoot, "file.md"), "project file");
            const result = await resolveInclude(
                makeInclude({ src: "file.md" }),
                projectRoot,
                undefined,
                undefined,
            );
            expect(result).toBe("project file");
        });
    });
});
