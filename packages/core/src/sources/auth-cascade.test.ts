import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
    execFile: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
    access: vi.fn(),
}));

import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import {
    clearAuthCache,
    getAuthSetupInstructions,
    resolveAuth,
    runAuthDiagnostic,
} from "./auth-cascade.js";

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
    delete process.env.GIT_SSH_COMMAND;
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

    it("git credential fill takes priority over gh-cli and SSH", async () => {
        // Both git credential and gh-cli would succeed, but git credential is tried first
        mockExecFile.mockImplementation(
            (cmd: string, args: string[], _opts: unknown, cb?: ExecCallback) => {
                const callback = typeof _opts === "function" ? (_opts as ExecCallback) : cb;
                if (cmd === "git" && args[0] === "credential") {
                    callback?.(
                        null,
                        "protocol=https\nhost=github.com\nusername=x\npassword=cred_token\n",
                        "",
                    );
                } else if (cmd === "gh" && args[0] === "auth") {
                    callback?.(null, "ghp_from_cli\n", "");
                } else {
                    callback?.(Object.assign(new Error("not found"), { code: 127 }), "", "");
                }
                return { stdin: { write: vi.fn(), end: vi.fn() } };
            },
        );

        const result = await resolveAuth("github.com");
        expect(result).toEqual({ method: "git-credential", token: "cred_token" });
    });

    it("gh-cli tried before SSH for GitHub hosts", async () => {
        // SSH keys exist and would connect, but gh-cli is tried first (after git-credential fails)
        mockAccess.mockResolvedValueOnce(undefined);

        mockExecFile.mockImplementation(
            (cmd: string, args: string[], _opts: unknown, cb?: ExecCallback) => {
                const callback = typeof _opts === "function" ? (_opts as ExecCallback) : cb;
                if (cmd === "gh" && args[0] === "auth") {
                    callback?.(null, "ghp_from_cli\n", "");
                } else if (cmd === "ssh") {
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
        expect(result).toEqual({ method: "gh-cli", token: "ghp_from_cli" });
    });

    it("returns ssh method when SSH keys exist and connectivity check passes", async () => {
        // SSH key exists
        mockAccess.mockResolvedValueOnce(undefined);

        // git credential and gh-cli fail, SSH connectivity check passes
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

    it("SSH still works when credential methods unavailable", async () => {
        // SSH key exists, no credential helpers
        mockAccess.mockResolvedValueOnce(undefined);

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

        // Non-GitHub host: gh-cli is skipped entirely
        const result = await resolveAuth("gitlab.example.com");
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

        // gh-cli is now tried BEFORE SSH, so this should return gh-cli
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

    it("returns none with triedMethods when all methods fail", async () => {
        const result = await resolveAuth("github.com");
        expect(result.method).toBe("none");
        expect(result.triedMethods).toEqual(["env", "git-credential", "gh-cli", "ssh"]);
    });

    it("non-GitHub hosts skip gh-cli in triedMethods", async () => {
        const result = await resolveAuth("gitlab.example.com");
        expect(result.method).toBe("none");
        expect(result.triedMethods).toEqual(["env", "git-credential", "ssh"]);
    });

    it("GIT_SSH_COMMAND respected in connectivity check", async () => {
        process.env.GIT_SSH_COMMAND = "/usr/bin/custom-ssh -i ~/.ssh/custom_key";
        mockAccess.mockResolvedValueOnce(undefined);

        mockExecFile.mockImplementation(
            (cmd: string, _args: string[], _opts: unknown, cb?: ExecCallback) => {
                const callback = typeof _opts === "function" ? (_opts as ExecCallback) : cb;
                if (cmd === "/usr/bin/custom-ssh") {
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

        const result = await resolveAuth("gitlab.example.com");
        expect(result).toEqual({ method: "ssh", useSSH: true });
        // Verify the custom command was called (not plain "ssh")
        expect(mockExecFile).toHaveBeenCalledWith(
            "/usr/bin/custom-ssh",
            expect.arrayContaining(["-i", "~/.ssh/custom_key", "-T", "git@gitlab.example.com"]),
            expect.anything(),
            expect.any(Function),
        );
    });

    it("logger receives debug messages", async () => {
        const messages: string[] = [];
        const logger = { debug: (msg: string) => messages.push(msg) };

        await resolveAuth("github.com", { logger });

        expect(messages.length).toBeGreaterThan(0);
        expect(messages.some((m) => m.includes("[auth]"))).toBe(true);
        expect(messages.some((m) => m.includes("environment variables"))).toBe(true);
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

describe("runAuthDiagnostic", () => {
    it("returns all steps for GitHub hosts", async () => {
        const steps = await runAuthDiagnostic("github.com");
        const methods = steps.map((s) => s.method);
        expect(methods).toEqual(["env", "git-credential", "gh-cli", "ssh"]);
    });

    it("skips gh-cli for non-GitHub hosts", async () => {
        const steps = await runAuthDiagnostic("gitlab.example.com");
        const methods = steps.map((s) => s.method);
        expect(methods).toEqual(["env", "git-credential", "ssh"]);
        expect(methods).not.toContain("gh-cli");
    });

    it("runs all methods without short-circuiting", async () => {
        process.env.GITHUB_TOKEN = "token";
        mockAccess.mockResolvedValueOnce(undefined);

        mockExecFile.mockImplementation(
            (cmd: string, args: string[], _opts: unknown, cb?: ExecCallback) => {
                const callback = typeof _opts === "function" ? (_opts as ExecCallback) : cb;
                if (cmd === "git" && args[0] === "credential") {
                    callback?.(
                        null,
                        "protocol=https\nhost=github.com\nusername=x\npassword=cred_token\n",
                        "",
                    );
                } else if (cmd === "gh" && args[0] === "auth") {
                    callback?.(null, "ghp_from_cli\n", "");
                } else if (cmd === "ssh") {
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

        const steps = await runAuthDiagnostic("github.com");
        // All 4 steps should be present even though env succeeds first
        expect(steps).toHaveLength(4);
        expect(steps.every((s) => s.success)).toBe(true);
    });
});

describe("getAuthSetupInstructions", () => {
    it("includes gh auth login for GitHub hosts", () => {
        const msg = getAuthSetupInstructions("github.com");
        expect(msg).toContain("gh auth login");
        expect(msg).toContain("gh auth setup-git");
        expect(msg).toContain("GITHUB_TOKEN");
    });

    it("includes BATON_GIT_TOKEN for non-GitHub hosts", () => {
        const msg = getAuthSetupInstructions("gitlab.example.com");
        expect(msg).toContain("BATON_GIT_TOKEN");
        expect(msg).not.toContain("gh auth login");
    });

    it("shows tried methods when provided", () => {
        const msg = getAuthSetupInstructions("github.com", [
            "env",
            "git-credential",
            "gh-cli",
            "ssh",
        ]);
        expect(msg).toContain("Tried: env, git-credential, gh-cli, ssh");
    });
});
