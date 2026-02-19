import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

import { execFile } from "node:child_process";
import { checkBinary } from "./mechanisms.js";

type ExecCallback = (error: Error | null, stdout: string, stderr: string) => void;

const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;

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
