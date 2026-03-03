import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
    execFile: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
    access: vi.fn(),
}));

import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { clearAuthCache, getAuthSetupInstructions, resolveAuth } from "./auth-cascade.js";

type ExecCallback = (
    error: (Error & { code?: number; killed?: boolean }) | null,
    stdout: string,
    stderr: string,
) => void;

const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;
const mockAccess = access as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.clearAllMocks();
    clearAuthCache();
    // Default: no SSH keys, no commands succeed
    mockAccess.mockRejectedValue(new Error("ENOENT"));
    mockExecFile.mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb?: ExecCallback) => {
            const callback = typeof _opts === "function" ? (_opts as ExecCallback) : cb;
            callback?.(Object.assign(new Error("not found"), { code: 127 }), "", "");
            return { stdin: { write: vi.fn(), end: vi.fn() } };
        },
    );
});

afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;
    delete process.env.BATON_GIT_TOKEN;
});

describe("resolveAuth", () => {
    it("returns env method when GITHUB_TOKEN is set", async () => {
        process.env.GITHUB_TOKEN = "ghp_test123";
        const result = await resolveAuth("github.com");
        expect(result).toEqual({ method: "env", token: "ghp_test123" });
    });

    it("returns env method when GH_TOKEN is set", async () => {
        process.env.GH_TOKEN = "ghp_gh_token";
        const result = await resolveAuth("github.com");
        expect(result).toEqual({ method: "env", token: "ghp_gh_token" });
    });

    it("returns env method when BATON_GIT_TOKEN is set", async () => {
        process.env.BATON_GIT_TOKEN = "custom_token";
        const result = await resolveAuth("gitlab.example.com");
        expect(result).toEqual({ method: "env", token: "custom_token" });
    });

    it("prefers GITHUB_TOKEN over GH_TOKEN", async () => {
        process.env.GITHUB_TOKEN = "primary";
        process.env.GH_TOKEN = "secondary";
        const result = await resolveAuth("github.com");
        expect(result.token).toBe("primary");
    });

    it("returns ssh method when SSH keys exist and connectivity check passes", async () => {
        // SSH key exists
        mockAccess.mockResolvedValueOnce(undefined);

        // SSH connectivity check: exit code 1 with success message (GitHub behavior)
        mockExecFile.mockImplementation(
            (cmd: string, _args: string[], _opts: unknown, cb?: ExecCallback) => {
                const callback = typeof _opts === "function" ? (_opts as ExecCallback) : cb;
                if (cmd === "ssh") {
                    callback?.(
                        Object.assign(new Error("exit 1"), { code: 1 }),
                        "",
                        "Hi user! You've successfully authenticated",
                    );
                } else {
                    callback?.(Object.assign(new Error("not found"), { code: 127 }), "", "");
                }
                return { stdin: { write: vi.fn(), end: vi.fn() } };
            },
        );

        const result = await resolveAuth("github.com");
        expect(result).toEqual({ method: "ssh", useSSH: true });
    });

    it("falls through SSH when key exists but connectivity fails", async () => {
        mockAccess.mockResolvedValueOnce(undefined);

        mockExecFile.mockImplementation(
            (cmd: string, args: string[], _opts: unknown, cb?: ExecCallback) => {
                const callback = typeof _opts === "function" ? (_opts as ExecCallback) : cb;
                if (cmd === "ssh") {
                    callback?.(
                        Object.assign(new Error("refused"), { code: 255 }),
                        "",
                        "Connection refused",
                    );
                } else if (cmd === "gh" && args[0] === "auth") {
                    callback?.(null, "ghp_from_gh_cli\n", "");
                } else {
                    callback?.(Object.assign(new Error("not found"), { code: 127 }), "", "");
                }
                return { stdin: { write: vi.fn(), end: vi.fn() } };
            },
        );

        const result = await resolveAuth("github.com");
        expect(result).toEqual({ method: "gh-cli", token: "ghp_from_gh_cli" });
    });

    it("returns gh-cli method when gh auth token succeeds", async () => {
        mockExecFile.mockImplementation(
            (cmd: string, args: string[], _opts: unknown, cb?: ExecCallback) => {
                const callback = typeof _opts === "function" ? (_opts as ExecCallback) : cb;
                if (cmd === "gh" && args[0] === "auth") {
                    callback?.(null, "ghp_from_cli\n", "");
                } else {
                    callback?.(Object.assign(new Error("not found"), { code: 127 }), "", "");
                }
                return { stdin: { write: vi.fn(), end: vi.fn() } };
            },
        );

        const result = await resolveAuth("github.com");
        expect(result).toEqual({ method: "gh-cli", token: "ghp_from_cli" });
    });

    it("skips gh-cli for non-GitHub hosts", async () => {
        mockExecFile.mockImplementation(
            (cmd: string, args: string[], _opts: unknown, cb?: ExecCallback) => {
                const callback = typeof _opts === "function" ? (_opts as ExecCallback) : cb;
                if (cmd === "git" && args[0] === "credential") {
                    callback?.(
                        null,
                        "protocol=https\nhost=gitlab.com\nusername=user\npassword=cred_token\n",
                        "",
                    );
                } else {
                    callback?.(Object.assign(new Error("not found"), { code: 127 }), "", "");
                }
                return { stdin: { write: vi.fn(), end: vi.fn() } };
            },
        );

        const result = await resolveAuth("gitlab.com");
        expect(result).toEqual({ method: "git-credential", token: "cred_token" });
    });

    it("returns git-credential method when credential helper provides a password", async () => {
        mockExecFile.mockImplementation(
            (cmd: string, args: string[], _opts: unknown, cb?: ExecCallback) => {
                const callback = typeof _opts === "function" ? (_opts as ExecCallback) : cb;
                if (cmd === "git" && args[0] === "credential") {
                    callback?.(
                        null,
                        "protocol=https\nhost=github.com\nusername=x\npassword=stored_token\n",
                        "",
                    );
                } else {
                    callback?.(Object.assign(new Error("not found"), { code: 127 }), "", "");
                }
                return { stdin: { write: vi.fn(), end: vi.fn() } };
            },
        );

        const result = await resolveAuth("github.com");
        expect(result).toEqual({ method: "git-credential", token: "stored_token" });
    });

    it("returns none when all methods fail", async () => {
        const result = await resolveAuth("github.com");
        expect(result).toEqual({ method: "none" });
    });

    it("caches results per hostname", async () => {
        process.env.GITHUB_TOKEN = "cached_token";
        const first = await resolveAuth("github.com");
        delete process.env.GITHUB_TOKEN;
        const second = await resolveAuth("github.com");
        expect(first).toBe(second);
    });

    it("caches independently per hostname", async () => {
        process.env.GITHUB_TOKEN = "token1";
        await resolveAuth("github.com");
        delete process.env.GITHUB_TOKEN;
        const result = await resolveAuth("gitlab.com");
        expect(result.method).toBe("none");
    });

    it("clearAuthCache resets the cache", async () => {
        process.env.GITHUB_TOKEN = "temp";
        await resolveAuth("github.com");
        delete process.env.GITHUB_TOKEN;
        clearAuthCache();
        const result = await resolveAuth("github.com");
        expect(result.method).toBe("none");
    });
});

describe("getAuthSetupInstructions", () => {
    it("includes gh auth login for GitHub hosts", () => {
        const msg = getAuthSetupInstructions("github.com");
        expect(msg).toContain("gh auth login");
        expect(msg).toContain("GITHUB_TOKEN");
    });

    it("includes BATON_GIT_TOKEN for non-GitHub hosts", () => {
        const msg = getAuthSetupInstructions("gitlab.example.com");
        expect(msg).toContain("BATON_GIT_TOKEN");
        expect(msg).not.toContain("gh auth login");
    });
});
