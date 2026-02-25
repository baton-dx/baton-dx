import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

import { execFile } from "node:child_process";
import {
  detectInstallMethod,
  formatInstallCommand,
  type InstallMethod,
} from "./detect-install-method.js";

type ExecCallback = (error: Error | null, stdout: string, stderr: string) => void;

const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("detectInstallMethod", () => {
  it("detects Homebrew from Cellar path", async () => {
    vi.stubGlobal("process", {
      ...process,
      argv: [process.argv[0], "/opt/homebrew/Cellar/baton-dx/0.5.0/bin/baton"],
    });

    const result = await detectInstallMethod();
    expect(result).toEqual({
      type: "homebrew",
      bin: "brew",
      args: ["upgrade", "baton-dx"],
    });

    vi.unstubAllGlobals();
  });

  it("detects Homebrew from homebrew path", async () => {
    vi.stubGlobal("process", {
      ...process,
      argv: [process.argv[0], "/usr/local/homebrew/bin/baton"],
    });

    const result = await detectInstallMethod();
    expect(result).toEqual({
      type: "homebrew",
      bin: "brew",
      args: ["upgrade", "baton-dx"],
    });

    vi.unstubAllGlobals();
  });

  it("detects pnpm from .pnpm path", async () => {
    vi.stubGlobal("process", {
      ...process,
      argv: [
        process.argv[0],
        "/home/user/.local/share/pnpm/node_modules/.pnpm/@baton-dx+cli/bin/baton",
      ],
    });

    const result = await detectInstallMethod();
    expect(result).toEqual({
      type: "pnpm",
      bin: "pnpm",
      args: ["update", "-g", "@baton-dx/cli", "--latest"],
    });

    vi.unstubAllGlobals();
  });

  it("detects bun from .bun path", async () => {
    vi.stubGlobal("process", {
      ...process,
      argv: [process.argv[0], "/home/user/.bun/install/global/node_modules/.bin/baton"],
    });

    const result = await detectInstallMethod();
    expect(result).toEqual({
      type: "bun",
      bin: "bun",
      args: ["update", "-g", "@baton-dx/cli", "--latest"],
    });

    vi.unstubAllGlobals();
  });

  it("detects npm from node_modules path", async () => {
    vi.stubGlobal("process", {
      ...process,
      argv: [process.argv[0], "/usr/local/lib/node_modules/@baton-dx/cli/bin/baton"],
    });

    const result = await detectInstallMethod();
    expect(result).toEqual({
      type: "npm",
      bin: "npm",
      args: ["install", "-g", "@baton-dx/cli@latest"],
    });

    vi.unstubAllGlobals();
  });

  it("returns unknown when path has no recognizable pattern", async () => {
    vi.stubGlobal("process", {
      ...process,
      argv: [process.argv[0], "/usr/local/bin/baton"],
    });

    const result = await detectInstallMethod();
    expect(result).toEqual({ type: "unknown" });

    vi.unstubAllGlobals();
  });

  it("falls back to which when process.argv[1] is empty", async () => {
    vi.stubGlobal("process", {
      ...process,
      argv: [process.argv[0], ""],
    });

    mockExecFile.mockImplementation((_cmd: string, _args: string[], cb: ExecCallback) => {
      cb(null, "/opt/homebrew/Cellar/baton-dx/0.5.0/bin/baton\n", "");
      return {};
    });

    const result = await detectInstallMethod();
    expect(result.type).toBe("homebrew");

    vi.unstubAllGlobals();
  });

  it("returns unknown when which fails and argv[1] is empty", async () => {
    vi.stubGlobal("process", {
      ...process,
      argv: [process.argv[0], ""],
    });

    mockExecFile.mockImplementation((_cmd: string, _args: string[], cb: ExecCallback) => {
      cb(new Error("not found"), "", "");
      return {};
    });

    const result = await detectInstallMethod();
    expect(result).toEqual({ type: "unknown" });

    vi.unstubAllGlobals();
  });

  it("prioritizes Homebrew over npm when path contains both patterns", async () => {
    vi.stubGlobal("process", {
      ...process,
      argv: [process.argv[0], "/opt/homebrew/Cellar/baton-dx/node_modules/bin/baton"],
    });

    const result = await detectInstallMethod();
    expect(result.type).toBe("homebrew");

    vi.unstubAllGlobals();
  });
});

describe("formatInstallCommand", () => {
  it("formats homebrew command", () => {
    const method: InstallMethod = { type: "homebrew", bin: "brew", args: ["upgrade", "baton-dx"] };
    expect(formatInstallCommand(method)).toBe("brew upgrade baton-dx");
  });

  it("formats npm command", () => {
    const method: InstallMethod = {
      type: "npm",
      bin: "npm",
      args: ["install", "-g", "@baton-dx/cli@latest"],
    };
    expect(formatInstallCommand(method)).toBe("npm install -g @baton-dx/cli@latest");
  });

  it("returns empty string for unknown", () => {
    const method: InstallMethod = { type: "unknown" };
    expect(formatInstallCommand(method)).toBe("");
  });
});
