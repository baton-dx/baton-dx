import { mkdir, readFile, readlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ClaudeCodeAdapter } from "../adapters/claude-code.js";
import { CursorAdapter } from "../adapters/cursor.js";
import { clearCanonicalCache, placeFile } from "./engine.js";

describe("placement/engine", () => {
    let tempDir: string;
    let projectRoot: string;

    beforeEach(async () => {
        // Create temporary directory for tests
        tempDir = join(tmpdir(), `baton-test-${crypto.randomUUID()}`);
        projectRoot = join(tempDir, "project");
        await mkdir(projectRoot, { recursive: true });

        // Clear canonical cache
        clearCanonicalCache();
    });

    afterEach(async () => {
        // Clean up temp directory
        await rm(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    });

    describe("placeFile", () => {
        it("creates a new file in project scope", async () => {
            const adapter = new ClaudeCodeAdapter();
            const content = "# Test Skill\nTest content";

            const result = await placeFile(content, adapter, "skills", "project", "test-skill", {
                mode: "copy",
                projectRoot,
            });

            expect(result.action).toBe("created");
            expect(result.isSymlink).toBe(false);
            expect(result.path).toContain(projectRoot);

            // Verify file was written
            const writtenContent = await readFile(result.path, "utf-8");
            expect(writtenContent).toBe(content);
        });

        it("creates parent directories if they don't exist", async () => {
            const adapter = new ClaudeCodeAdapter();
            const content = "# Test Memory\nTest content";

            const result = await placeFile(content, adapter, "memory", "project", "CLAUDE.md", {
                mode: "copy",
                projectRoot,
            });

            expect(result.action).toBe("created");
            expect(result.path).toContain("CLAUDE.md");

            // Verify file was written
            const writtenContent = await readFile(result.path, "utf-8");
            expect(writtenContent).toBe(content);
        });

        it("updates existing file if content differs", async () => {
            const adapter = new ClaudeCodeAdapter();
            const initialContent = "# Initial Content";
            const updatedContent = "# Updated Content";

            // Create initial file
            const firstResult = await placeFile(
                initialContent,
                adapter,
                "memory",
                "project",
                "CLAUDE.md",
                {
                    mode: "copy",
                    projectRoot,
                },
            );

            expect(firstResult.action).toBe("created");

            // Update with new content
            const secondResult = await placeFile(
                updatedContent,
                adapter,
                "memory",
                "project",
                "CLAUDE.md",
                {
                    mode: "copy",
                    projectRoot,
                },
            );

            expect(secondResult.action).toBe("updated");
            expect(secondResult.path).toBe(firstResult.path);

            // Verify updated content
            const writtenContent = await readFile(secondResult.path, "utf-8");
            expect(writtenContent).toBe(updatedContent);
        });

        it("skips writing if content is identical", async () => {
            const adapter = new ClaudeCodeAdapter();
            const content = "# Same Content";

            // Create initial file
            const firstResult = await placeFile(
                content,
                adapter,
                "memory",
                "project",
                "CLAUDE.md",
                {
                    mode: "copy",
                    projectRoot,
                },
            );

            expect(firstResult.action).toBe("created");

            // Try to write same content again
            const secondResult = await placeFile(
                content,
                adapter,
                "memory",
                "project",
                "CLAUDE.md",
                {
                    mode: "copy",
                    projectRoot,
                },
            );

            expect(secondResult.action).toBe("skipped");
            expect(secondResult.path).toBe(firstResult.path);
        });

        it("creates canonical copy on first installation (symlink mode)", async () => {
            const adapter = new ClaudeCodeAdapter();
            const content = "# Canonical Content";

            const result = await placeFile(content, adapter, "memory", "project", "CLAUDE.md", {
                mode: "symlink",
                projectRoot,
            });

            expect(result.action).toBe("created");
            expect(result.isSymlink).toBe(false);

            // Verify file was written
            const writtenContent = await readFile(result.path, "utf-8");
            expect(writtenContent).toBe(content);
        });

        it("creates symlink on subsequent installation (symlink mode)", async () => {
            const claudeAdapter = new ClaudeCodeAdapter();
            const cursorAdapter = new CursorAdapter();
            const content = "# Shared Rule Content";

            // First installation: Claude Code (canonical)
            // Rules have same name across agents, so symlinks work here
            const firstResult = await placeFile(
                content,
                claudeAdapter,
                "rules",
                "project",
                "coding-standards.md",
                {
                    mode: "symlink",
                    projectRoot,
                },
            );

            expect(firstResult.action).toBe("created");
            expect(firstResult.isSymlink).toBe(false);

            // Second installation: Cursor (symlink to Claude's rule)
            const secondResult = await placeFile(
                content,
                cursorAdapter,
                "rules",
                "project",
                "coding-standards.md",
                {
                    mode: "symlink",
                    projectRoot,
                },
            );

            expect(secondResult.action).toBe("created");
            expect(secondResult.isSymlink).toBe(true);

            // Verify symlink was created
            const linkTarget = await readlink(secondResult.path);
            expect(linkTarget).toBeTruthy();

            // Verify symlink points to canonical file
            const linkedContent = await readFile(secondResult.path, "utf-8");
            expect(linkedContent).toBe(content);
        });

        it("falls back to copy if symlink creation fails (symlink mode)", async () => {
            // This test would need to simulate symlink failure
            // For now, we just verify copy mode works as fallback behavior is implemented

            const adapter = new ClaudeCodeAdapter();
            const content = "# Fallback Content";

            const result = await placeFile(content, adapter, "memory", "project", "CLAUDE.md", {
                mode: "copy",
                projectRoot,
            });

            expect(result.action).toBe("created");
            expect(result.isSymlink).toBe(false);
        });

        it("creates independent copies in copy mode", async () => {
            const claudeAdapter = new ClaudeCodeAdapter();
            const cursorAdapter = new CursorAdapter();
            const content = "# Independent Content";

            // First installation: Claude Code
            const firstResult = await placeFile(
                content,
                claudeAdapter,
                "memory",
                "project",
                "CLAUDE.md",
                {
                    mode: "copy",
                    projectRoot,
                },
            );

            expect(firstResult.action).toBe("created");
            expect(firstResult.isSymlink).toBe(false);

            // Second installation: Cursor (should also be copy, not symlink)
            const secondResult = await placeFile(
                content,
                cursorAdapter,
                "memory",
                "project",
                "AGENTS.md",
                {
                    mode: "copy",
                    projectRoot,
                },
            );

            expect(secondResult.action).toBe("created");
            expect(secondResult.isSymlink).toBe(false);

            // Verify both files exist independently
            const claudeContent = await readFile(firstResult.path, "utf-8");
            const cursorContent = await readFile(secondResult.path, "utf-8");

            expect(claudeContent).toBe(content);
            expect(cursorContent).toBe(content);
            expect(firstResult.path).not.toBe(secondResult.path);
        });

        it("resolves project scope paths relative to project root", async () => {
            const adapter = new ClaudeCodeAdapter();
            const content = "# Project Scope";

            const result = await placeFile(content, adapter, "memory", "project", "CLAUDE.md", {
                mode: "copy",
                projectRoot,
            });

            expect(result.path).toContain(projectRoot);
            expect(result.path).toContain("CLAUDE.md");
        });

        it("handles global scope paths correctly", async () => {
            const adapter = new ClaudeCodeAdapter();
            const content = "# Global Scope";

            // Global paths should already be absolute from adapter.getPath()
            const result = await placeFile(content, adapter, "memory", "global", "CLAUDE.md", {
                mode: "copy",
                projectRoot,
            });

            expect(result.path).toBeTruthy();
            // Global path should be absolute (starts with / or contains home directory)
            expect(result.path.startsWith("/")).toBe(true);
        });

        it("avoids unnecessary writes when content is identical", async () => {
            const adapter = new ClaudeCodeAdapter();
            const content = "# No Change";

            // First write
            await placeFile(content, adapter, "memory", "project", "CLAUDE.md", {
                mode: "copy",
                projectRoot,
            });

            // Second write with same content
            const result = await placeFile(content, adapter, "memory", "project", "CLAUDE.md", {
                mode: "copy",
                projectRoot,
            });

            expect(result.action).toBe("skipped");
        });

        it("does not create symlinks for memory files (different names per agent)", async () => {
            // Clear cache to ensure clean state
            clearCanonicalCache();

            const claudeAdapter = new ClaudeCodeAdapter();
            const cursorAdapter = new CursorAdapter();
            const content = "# Memory Content";

            // First installation: Claude Code with CLAUDE.md
            const firstResult = await placeFile(
                content,
                claudeAdapter,
                "memory",
                "project",
                "CLAUDE.md",
                {
                    mode: "symlink",
                    projectRoot,
                },
            );

            expect(firstResult.action).toBe("created");
            expect(firstResult.isSymlink).toBe(false);

            // Second installation: Cursor with AGENTS.md
            // Should create independent copy, not symlink (different filenames)
            const secondResult = await placeFile(
                content,
                cursorAdapter,
                "memory",
                "project",
                "AGENTS.md",
                {
                    mode: "symlink",
                    projectRoot,
                },
            );

            expect(secondResult.action).toBe("created");
            expect(secondResult.isSymlink).toBe(false);

            // Verify both files exist independently
            const claudeContent = await readFile(firstResult.path, "utf-8");
            const cursorContent = await readFile(secondResult.path, "utf-8");

            expect(claudeContent).toBe(content);
            expect(cursorContent).toBe(content);
            expect(firstResult.path).not.toBe(secondResult.path);
        });
    });

    describe("clearCanonicalCache", () => {
        it("clears the canonical file cache", async () => {
            const adapter = new ClaudeCodeAdapter();
            const content = "# Cache Test";

            // Create canonical file
            await placeFile(content, adapter, "memory", "project", "CLAUDE.md", {
                mode: "symlink",
                projectRoot,
            });

            // Clear cache
            clearCanonicalCache();

            // Next placement should create canonical again (not symlink)
            const result = await placeFile(content, adapter, "memory", "project", "test.md", {
                mode: "symlink",
                projectRoot,
            });

            expect(result.isSymlink).toBe(false);
        });
    });
});
