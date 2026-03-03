import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
    execFile: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
    access: vi.fn(),
    constants: { R_OK: 4 },
    readdir: vi.fn(),
}));

vi.mock("node:os", () => ({
    homedir: vi.fn(() => "/home/testuser"),
}));

import { execFile } from "node:child_process";
import { access, readdir } from "node:fs/promises";
import { AI_TOOL_PATHS } from "@baton-dx/ai-tool-paths";
import * as mechanisms from "./mechanisms.js";

const {
    checkAppBundle,
    checkBinary,
    checkDirectory,
    checkJetbrainsPlugin,
    checkVscodeExtension,
    evaluateDetection,
} = mechanisms;

type ExecCallback = (error: Error | null, stdout: string, stderr: string) => void;

const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;
const mockAccess = access as unknown as ReturnType<typeof vi.fn>;
const mockReaddir = readdir as unknown as ReturnType<typeof vi.fn>;

function successCallback(stdout: string, stderr = "") {
    return (_cmd: string, _args: string[], _opts: object, cb: ExecCallback) => {
        cb(null, stdout, stderr);
        return {};
    };
}

function errorCallback(message = "not found") {
    return (_cmd: string, _args: string[], _opts: object, cb: ExecCallback) => {
        cb(new Error(message), "", "");
        return {};
    };
}

const originalPlatform = process.platform;

describe("checkBinary", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(process, "platform", { value: "darwin" });
    });

    afterEach(() => {
        Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("returns true when binary exists and no version pattern", async () => {
        mockExecFile.mockImplementationOnce(successCallback("/usr/bin/claude"));

        const result = await checkBinary({
            type: "binary",
            name: "claude",
        });

        expect(result).toBe(true);
        expect(mockExecFile).toHaveBeenCalledWith("which", ["claude"], {}, expect.any(Function));
    });

    it("returns false when binary not found in PATH", async () => {
        mockExecFile.mockImplementationOnce(errorCallback("not found"));

        const result = await checkBinary({
            type: "binary",
            name: "nonexistent",
        });

        expect(result).toBe(false);
    });

    it("returns true when version output matches pattern", async () => {
        mockExecFile.mockImplementationOnce(successCallback("/usr/bin/claude"));
        mockExecFile.mockImplementationOnce(successCallback("claude v1.2.3"));

        const result = await checkBinary({
            type: "binary",
            name: "claude",
            versionPattern: /claude/i,
        });

        expect(result).toBe(true);
        expect(mockExecFile).toHaveBeenCalledTimes(2);
        expect(mockExecFile).toHaveBeenLastCalledWith(
            "claude",
            ["--version"],
            { timeout: 5000 },
            expect.any(Function),
        );
    });

    it("returns false when version output does not match pattern (collision)", async () => {
        mockExecFile.mockImplementationOnce(successCallback("/usr/bin/opencode"));
        mockExecFile.mockImplementationOnce(successCallback("litestar framework v2.0"));

        const result = await checkBinary({
            type: "binary",
            name: "opencode",
            versionPattern: /sst/i,
        });

        expect(result).toBe(false);
    });

    it("returns false when platform does not match", async () => {
        const result = await checkBinary({
            type: "binary",
            name: "claude",
            platforms: ["linux", "win32"],
        });

        expect(result).toBe(false);
        expect(mockExecFile).not.toHaveBeenCalled();
    });

    it("uses 'where' command on win32", async () => {
        Object.defineProperty(process, "platform", { value: "win32" });
        mockExecFile.mockImplementationOnce(successCallback("C:\\Program Files\\claude.exe"));

        const result = await checkBinary({
            type: "binary",
            name: "claude",
        });

        expect(result).toBe(true);
        expect(mockExecFile).toHaveBeenCalledWith("where", ["claude"], {}, expect.any(Function));
    });

    it("returns false when version command times out", async () => {
        mockExecFile.mockImplementationOnce(successCallback("/usr/bin/claude"));
        mockExecFile.mockImplementationOnce(errorCallback("Command timed out"));

        const result = await checkBinary({
            type: "binary",
            name: "claude",
            versionPattern: /claude/i,
        });

        expect(result).toBe(false);
    });

    it("uses custom versionFlag when provided", async () => {
        mockExecFile.mockImplementationOnce(successCallback("/usr/bin/amp"));
        mockExecFile.mockImplementationOnce(successCallback("amp v0.1 (sourcegraph)"));

        const result = await checkBinary({
            type: "binary",
            name: "amp",
            versionFlag: "version",
            versionPattern: /amp|sourcegraph/i,
        });

        expect(result).toBe(true);
        expect(mockExecFile).toHaveBeenLastCalledWith(
            "amp",
            ["version"],
            { timeout: 5000 },
            expect.any(Function),
        );
    });
});

describe("checkDirectory", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(process, "platform", { value: "darwin" });
    });

    afterEach(() => {
        Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("returns true when directory exists and no marker file", async () => {
        mockAccess.mockResolvedValueOnce(undefined);

        const result = await checkDirectory({
            type: "directory",
            path: "/usr/local/share/tool",
        });

        expect(result).toBe(true);
        expect(mockAccess).toHaveBeenCalledOnce();
    });

    it("returns false when directory does not exist", async () => {
        mockAccess.mockRejectedValueOnce(new Error("ENOENT"));

        const result = await checkDirectory({
            type: "directory",
            path: "/nonexistent/dir",
        });

        expect(result).toBe(false);
    });

    it("returns true when directory and marker file both exist", async () => {
        mockAccess.mockResolvedValueOnce(undefined);
        mockAccess.mockResolvedValueOnce(undefined);

        const result = await checkDirectory({
            type: "directory",
            path: "/home/testuser/.cline",
            markerFile: "settings.json",
        });

        expect(result).toBe(true);
        expect(mockAccess).toHaveBeenCalledTimes(2);
    });

    it("returns false when directory exists but marker file is missing", async () => {
        mockAccess.mockResolvedValueOnce(undefined);
        mockAccess.mockRejectedValueOnce(new Error("ENOENT"));

        const result = await checkDirectory({
            type: "directory",
            path: "/home/testuser/.cline",
            markerFile: "settings.json",
        });

        expect(result).toBe(false);
    });

    it("returns false when platform does not match", async () => {
        const result = await checkDirectory({
            type: "directory",
            path: "~/.config/tool",
            platforms: ["linux", "win32"],
        });

        expect(result).toBe(false);
        expect(mockAccess).not.toHaveBeenCalled();
    });

    it("expands tilde to home directory", async () => {
        mockAccess.mockResolvedValueOnce(undefined);

        const result = await checkDirectory({
            type: "directory",
            path: "~/.claude",
        });

        expect(result).toBe(true);
        expect(mockAccess).toHaveBeenCalledWith("/home/testuser/.claude", 4);
    });
});

describe("checkAppBundle", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(process, "platform", { value: "darwin" });
    });

    afterEach(() => {
        Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("returns true when app found in /Applications on darwin", async () => {
        mockAccess.mockResolvedValueOnce(undefined);

        const result = await checkAppBundle({
            type: "app",
            name: "Cursor.app",
        });

        expect(result).toBe(true);
        expect(mockAccess).toHaveBeenCalledWith("/Applications/Cursor.app");
    });

    it("returns false on non-darwin platform", async () => {
        Object.defineProperty(process, "platform", { value: "linux" });

        const result = await checkAppBundle({
            type: "app",
            name: "Cursor.app",
        });

        expect(result).toBe(false);
        expect(mockAccess).not.toHaveBeenCalled();
    });

    it("returns true when app found in ~/Applications", async () => {
        mockAccess.mockRejectedValueOnce(new Error("ENOENT"));
        mockAccess.mockResolvedValueOnce(undefined);

        const result = await checkAppBundle({
            type: "app",
            name: "Cursor.app",
        });

        expect(result).toBe(true);
        expect(mockAccess).toHaveBeenCalledTimes(2);
        expect(mockAccess).toHaveBeenLastCalledWith("/home/testuser/Applications/Cursor.app");
    });

    it("returns false when app not found anywhere", async () => {
        mockAccess.mockRejectedValueOnce(new Error("ENOENT"));
        mockAccess.mockRejectedValueOnce(new Error("ENOENT"));

        const result = await checkAppBundle({
            type: "app",
            name: "NonExistent.app",
        });

        expect(result).toBe(false);
        expect(mockAccess).toHaveBeenCalledTimes(2);
    });

    it("supports custom searchPaths override", async () => {
        mockAccess.mockResolvedValueOnce(undefined);

        const result = await checkAppBundle({
            type: "app",
            name: "Custom.app",
            searchPaths: ["/opt/apps"],
        });

        expect(result).toBe(true);
        expect(mockAccess).toHaveBeenCalledWith("/opt/apps/Custom.app");
    });
});

describe("checkVscodeExtension", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns true when extension found by prefix match", async () => {
        mockReaddir.mockResolvedValueOnce(["github.copilot-1.234.0", "ms-python.python-2024.1.0"]);

        const result = await checkVscodeExtension({
            type: "vscode-extension",
            extensionId: "GitHub.copilot",
        });

        expect(result).toBe(true);
        expect(mockReaddir).toHaveBeenCalledWith("/home/testuser/.vscode/extensions");
    });

    it("returns false when extension not installed", async () => {
        mockReaddir.mockResolvedValueOnce(["ms-python.python-2024.1.0"]);

        const result = await checkVscodeExtension({
            type: "vscode-extension",
            extensionId: "GitHub.copilot",
        });

        expect(result).toBe(false);
    });

    it("checks multiple editors and finds in second", async () => {
        mockReaddir.mockResolvedValueOnce(["ms-python.python-2024.1.0"]);
        mockReaddir.mockResolvedValueOnce(["saoudrizwan.claude-dev-3.2.0"]);

        const result = await checkVscodeExtension({
            type: "vscode-extension",
            extensionId: "saoudrizwan.claude-dev",
            editors: ["vscode", "cursor"],
        });

        expect(result).toBe(true);
        expect(mockReaddir).toHaveBeenCalledTimes(2);
        expect(mockReaddir).toHaveBeenNthCalledWith(1, "/home/testuser/.vscode/extensions");
        expect(mockReaddir).toHaveBeenNthCalledWith(2, "/home/testuser/.cursor/extensions");
    });

    it("returns false when extension directory missing (no error)", async () => {
        mockReaddir.mockRejectedValueOnce(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));

        const result = await checkVscodeExtension({
            type: "vscode-extension",
            extensionId: "GitHub.copilot",
        });

        expect(result).toBe(false);
    });
});

describe("checkJetbrainsPlugin", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(process, "platform", { value: "darwin" });
    });

    afterEach(() => {
        Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("returns true when plugin found across IDE versions", async () => {
        // First readdir: list IDE version directories
        mockReaddir.mockResolvedValueOnce(["IntelliJIdea2024.3", "IntelliJIdea2025.1"]);
        // Second readdir: plugins in first version — no match
        mockReaddir.mockResolvedValueOnce(["kotlin", "gradle"]);
        // Third readdir: plugins in second version — match
        mockReaddir.mockResolvedValueOnce(["junie", "kotlin", "gradle"]);

        const result = await checkJetbrainsPlugin({
            type: "jetbrains-plugin",
            pluginId: "junie",
        });

        expect(result).toBe(true);
        expect(mockReaddir).toHaveBeenCalledTimes(3);
        expect(mockReaddir).toHaveBeenNthCalledWith(
            1,
            "/home/testuser/Library/Application Support/JetBrains",
        );
        expect(mockReaddir).toHaveBeenNthCalledWith(
            2,
            "/home/testuser/Library/Application Support/JetBrains/IntelliJIdea2024.3/plugins",
        );
        expect(mockReaddir).toHaveBeenNthCalledWith(
            3,
            "/home/testuser/Library/Application Support/JetBrains/IntelliJIdea2025.1/plugins",
        );
    });

    it("returns false when JetBrains config directory does not exist", async () => {
        mockReaddir.mockRejectedValueOnce(new Error("ENOENT"));

        const result = await checkJetbrainsPlugin({
            type: "jetbrains-plugin",
            pluginId: "junie",
        });

        expect(result).toBe(false);
    });

    it("returns false when config exists but plugin not installed", async () => {
        mockReaddir.mockResolvedValueOnce(["IntelliJIdea2025.1"]);
        mockReaddir.mockResolvedValueOnce(["kotlin", "gradle"]);

        const result = await checkJetbrainsPlugin({
            type: "jetbrains-plugin",
            pluginId: "junie",
        });

        expect(result).toBe(false);
    });

    it("uses correct config path on linux", async () => {
        Object.defineProperty(process, "platform", { value: "linux" });
        mockReaddir.mockResolvedValueOnce(["IntelliJIdea2025.1"]);
        mockReaddir.mockResolvedValueOnce(["junie"]);

        const result = await checkJetbrainsPlugin({
            type: "jetbrains-plugin",
            pluginId: "junie",
        });

        expect(result).toBe(true);
        expect(mockReaddir).toHaveBeenNthCalledWith(1, "/home/testuser/.config/JetBrains");
    });

    it("uses correct config path on win32", async () => {
        Object.defineProperty(process, "platform", { value: "win32" });
        const originalAppdata = process.env.APPDATA;
        process.env.APPDATA = "C:\\Users\\testuser\\AppData\\Roaming";

        mockReaddir.mockResolvedValueOnce(["IntelliJIdea2025.1"]);
        mockReaddir.mockResolvedValueOnce(["junie"]);

        const result = await checkJetbrainsPlugin({
            type: "jetbrains-plugin",
            pluginId: "junie",
        });

        expect(result).toBe(true);
        expect(mockReaddir).toHaveBeenNthCalledWith(
            1,
            "C:\\Users\\testuser\\AppData\\Roaming/JetBrains",
        );

        process.env.APPDATA = originalAppdata;
    });

    it("handles missing plugins directory in a version gracefully", async () => {
        mockReaddir.mockResolvedValueOnce(["IntelliJIdea2025.1", "GoLand2025.1"]);
        // First version: plugins dir missing
        mockReaddir.mockRejectedValueOnce(new Error("ENOENT"));
        // Second version: has the plugin
        mockReaddir.mockResolvedValueOnce(["junie"]);

        const result = await checkJetbrainsPlugin({
            type: "jetbrains-plugin",
            pluginId: "junie",
        });

        expect(result).toBe(true);
    });
});

describe("evaluateDetection", () => {
    type MockFn = ReturnType<typeof vi.fn>;
    let spyBinary: MockFn;
    let spyDirectory: MockFn;
    let spyAppBundle: MockFn;
    let spyVscodeExtension: MockFn;
    let spyJetbrainsPlugin: MockFn;

    beforeEach(() => {
        vi.clearAllMocks();
        // Spy on checkHandlers (the dispatch object) rather than module exports.
        // ESM module exports are not interceptable for intra-module calls, but
        // object property lookups in checkHandlers happen at call time.
        spyBinary = vi.spyOn(mechanisms.checkHandlers, "binary") as unknown as MockFn;
        spyDirectory = vi.spyOn(mechanisms.checkHandlers, "directory") as unknown as MockFn;
        spyAppBundle = vi.spyOn(mechanisms.checkHandlers, "app") as unknown as MockFn;
        spyVscodeExtension = vi.spyOn(
            mechanisms.checkHandlers,
            "vscode-extension",
        ) as unknown as MockFn;
        spyJetbrainsPlugin = vi.spyOn(
            mechanisms.checkHandlers,
            "jetbrains-plugin",
        ) as unknown as MockFn;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns true when single group with single check passes", async () => {
        spyBinary.mockResolvedValueOnce(true);

        const result = await evaluateDetection({
            groups: [[{ type: "binary", name: "claude" }]],
        });

        expect(result).toBe(true);
        expect(spyBinary).toHaveBeenCalledOnce();
    });

    it("returns false when single group fails", async () => {
        spyBinary.mockResolvedValueOnce(false);

        const result = await evaluateDetection({
            groups: [[{ type: "binary", name: "nonexistent" }]],
        });

        expect(result).toBe(false);
    });

    it("returns true when any group passes (OR logic)", async () => {
        spyBinary.mockResolvedValueOnce(false);
        spyDirectory.mockResolvedValueOnce(true);

        const result = await evaluateDetection({
            groups: [
                [{ type: "binary", name: "nonexistent" }],
                [{ type: "directory", path: "~/.claude" }],
            ],
        });

        expect(result).toBe(true);
    });

    it("returns false when no groups pass", async () => {
        spyBinary.mockResolvedValueOnce(false);
        spyDirectory.mockResolvedValueOnce(false);

        const result = await evaluateDetection({
            groups: [
                [{ type: "binary", name: "nonexistent" }],
                [{ type: "directory", path: "/does/not/exist" }],
            ],
        });

        expect(result).toBe(false);
    });

    it("returns true when all checks in a group pass (AND logic)", async () => {
        spyBinary.mockResolvedValueOnce(true);
        spyDirectory.mockResolvedValueOnce(true);

        const result = await evaluateDetection({
            groups: [
                [
                    { type: "binary", name: "claude" },
                    { type: "directory", path: "~/.claude" },
                ],
            ],
        });

        expect(result).toBe(true);
        expect(spyBinary).toHaveBeenCalledOnce();
        expect(spyDirectory).toHaveBeenCalledOnce();
    });

    it("returns false when one check in a group fails (AND logic)", async () => {
        spyBinary.mockResolvedValueOnce(true);
        spyDirectory.mockResolvedValueOnce(false);

        const result = await evaluateDetection({
            groups: [
                [
                    { type: "binary", name: "claude" },
                    { type: "directory", path: "~/.claude", markerFile: "settings.json" },
                ],
            ],
        });

        expect(result).toBe(false);
    });

    it("returns true with mixed groups when one passes (OR of ANDs)", async () => {
        // First group: binary fails → group fails
        spyBinary.mockResolvedValueOnce(false);
        spyDirectory.mockResolvedValueOnce(true);
        // Second group: app check passes → group passes
        spyAppBundle.mockResolvedValueOnce(true);

        const result = await evaluateDetection({
            groups: [
                [
                    { type: "binary", name: "nonexistent" },
                    { type: "directory", path: "~/.tool" },
                ],
                [{ type: "app", name: "Tool.app" }],
            ],
        });

        expect(result).toBe(true);
        expect(spyAppBundle).toHaveBeenCalledOnce();
    });

    it("dispatches to correct check function by type", async () => {
        spyVscodeExtension.mockResolvedValueOnce(false);
        spyJetbrainsPlugin.mockResolvedValueOnce(false);

        await evaluateDetection({
            groups: [
                [{ type: "vscode-extension", extensionId: "github.copilot" }],
                [{ type: "jetbrains-plugin", pluginId: "junie" }],
            ],
        });

        expect(spyVscodeExtension).toHaveBeenCalledWith({
            type: "vscode-extension",
            extensionId: "github.copilot",
        });
        expect(spyJetbrainsPlugin).toHaveBeenCalledWith({
            type: "jetbrains-plugin",
            pluginId: "junie",
        });
    });
});

describe("false positive regression tests", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(process, "platform", { value: "darwin" });
    });

    afterEach(() => {
        Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    function getDetectionConfig(key: string) {
        const entry = AI_TOOL_PATHS.find((a) => a.key === key);
        if (!entry?.detectionConfig) {
            throw new Error(`No detectionConfig for agent: ${key}`);
        }
        return entry.detectionConfig;
    }

    it("GitHub Copilot NOT detected when only gh CLI is installed", async () => {
        // Config checks 'copilot' binary, NOT 'gh' — gh being installed is irrelevant
        mockExecFile.mockImplementation(
            (_cmd: string, _args: string[], _opts: object, cb: ExecCallback) => {
                cb(new Error("not found"), "", "");
                return {};
            },
        );
        mockReaddir.mockRejectedValue(new Error("ENOENT"));
        mockAccess.mockRejectedValue(new Error("ENOENT"));

        const result = await evaluateDetection(getDetectionConfig("github-copilot"));
        expect(result).toBe(false);
    });

    it("OpenCode NOT detected when Litestar's opencode binary is installed", async () => {
        // Binary exists but version output is from Litestar, not SST/OpenCode
        mockExecFile.mockImplementation(
            (cmd: string, args: string[], _opts: object, cb: ExecCallback) => {
                if (cmd === "which" && args[0] === "opencode") {
                    cb(null, "/usr/bin/opencode", "");
                } else if (cmd === "opencode") {
                    // Litestar output — does NOT match /opencode|sst/i
                    cb(null, "litestar framework v2.0", "");
                } else {
                    cb(new Error("not found"), "", "");
                }
                return {};
            },
        );
        mockAccess.mockRejectedValue(new Error("ENOENT"));

        const result = await evaluateDetection(getDetectionConfig("opencode"));
        expect(result).toBe(false);
    });

    it("Cline NOT detected from empty leftover ~/.cline/ directory", async () => {
        // No VS Code extension installed, directory exists but settings.json missing
        mockReaddir.mockRejectedValue(new Error("ENOENT"));
        mockAccess.mockImplementation((filePath: string) => {
            if (filePath === "/home/testuser/.cline") {
                return Promise.resolve(undefined);
            }
            return Promise.reject(new Error("ENOENT"));
        });

        const result = await evaluateDetection(getDetectionConfig("cline"));
        expect(result).toBe(false);
    });

    it("Windsurf NOT detected from leftover ~/.codeium/windsurf/ without settings.json", async () => {
        // No app bundle, no binary, directory exists but settings.json missing
        mockExecFile.mockImplementation(
            (_cmd: string, _args: string[], _opts: object, cb: ExecCallback) => {
                cb(new Error("not found"), "", "");
                return {};
            },
        );
        mockAccess.mockImplementation((filePath: string) => {
            if (filePath === "/home/testuser/.codeium/windsurf") {
                return Promise.resolve(undefined);
            }
            return Promise.reject(new Error("ENOENT"));
        });

        const result = await evaluateDetection(getDetectionConfig("windsurf"));
        expect(result).toBe(false);
    });

    it("Codex NOT detected from leftover ~/.codex/ without config.toml", async () => {
        // No binary, directory exists but config.toml missing
        mockExecFile.mockImplementation(
            (_cmd: string, _args: string[], _opts: object, cb: ExecCallback) => {
                cb(new Error("not found"), "", "");
                return {};
            },
        );
        mockAccess.mockImplementation((filePath: string) => {
            if (filePath === "/home/testuser/.codex") {
                return Promise.resolve(undefined);
            }
            return Promise.reject(new Error("ENOENT"));
        });

        const result = await evaluateDetection(getDetectionConfig("codex"));
        expect(result).toBe(false);
    });

    it("Trae NOT detected from leftover ~/.trae/ without settings.json", async () => {
        // No app bundle, directory exists but settings.json missing
        mockAccess.mockImplementation((filePath: string) => {
            if (filePath === "/home/testuser/.trae") {
                return Promise.resolve(undefined);
            }
            return Promise.reject(new Error("ENOENT"));
        });

        const result = await evaluateDetection(getDetectionConfig("trae"));
        expect(result).toBe(false);
    });
});
