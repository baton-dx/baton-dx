import { describe, expect, test } from "vitest";
import { transformEnvVars } from "./env-transform.js";

describe("transformEnvVars", () => {
  describe("dollar-brace (pass-through)", () => {
    test("passes ${VAR} through unchanged", () => {
      const { env, warnings } = transformEnvVars({ KEY: "${HOME}" }, "dollar-brace");
      expect(env.KEY).toBe("${HOME}");
      expect(warnings).toHaveLength(0);
    });

    test("passes ${VAR:-default} through unchanged", () => {
      const { env } = transformEnvVars({ KEY: "${PORT:-3000}" }, "dollar-brace");
      expect(env.KEY).toBe("${PORT:-3000}");
    });
  });

  describe("dollar-env-colon", () => {
    test("transforms ${VAR} to ${env:VAR}", () => {
      const { env, warnings } = transformEnvVars({ KEY: "${HOME}" }, "dollar-env-colon");
      expect(env.KEY).toBe("${env:HOME}");
      expect(warnings).toHaveLength(0);
    });

    test("transforms ${VAR:-default} to ${env:VAR:-default}", () => {
      const { env } = transformEnvVars({ KEY: "${PORT:-3000}" }, "dollar-env-colon");
      expect(env.KEY).toBe("${env:PORT:-3000}");
    });

    test("handles multiple env vars in record", () => {
      const { env } = transformEnvVars(
        { A: "${FOO}", B: "${BAR:-baz}" },
        "dollar-env-colon",
      );
      expect(env.A).toBe("${env:FOO}");
      expect(env.B).toBe("${env:BAR:-baz}");
    });
  });

  describe("env-colon", () => {
    test("transforms ${VAR} to {env:VAR}", () => {
      const { env, warnings } = transformEnvVars({ KEY: "${HOME}" }, "env-colon");
      expect(env.KEY).toBe("{env:HOME}");
      expect(warnings).toHaveLength(0);
    });

    test("transforms ${VAR:-default} to {env:VAR:-default}", () => {
      const { env } = transformEnvVars({ KEY: "${PORT:-3000}" }, "env-colon");
      expect(env.KEY).toBe("{env:PORT:-3000}");
    });
  });

  describe("expand", () => {
    test("resolves value from processEnv", () => {
      const { env, warnings } = transformEnvVars(
        { KEY: "${HOME}" },
        "expand",
        { HOME: "/home/user" },
      );
      expect(env.KEY).toBe("/home/user");
      expect(warnings).toHaveLength(0);
    });

    test("uses default when var not set", () => {
      const { env, warnings } = transformEnvVars(
        { KEY: "${PORT:-3000}" },
        "expand",
        {},
      );
      expect(env.KEY).toBe("3000");
      expect(warnings).toHaveLength(0);
    });

    test("warns and returns original when var not set and no default", () => {
      const { env, warnings } = transformEnvVars(
        { KEY: "${MISSING_VAR}" },
        "expand",
        {},
      );
      expect(env.KEY).toBe("${MISSING_VAR}");
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("MISSING_VAR");
    });

    test("prefers env value over default", () => {
      const { env } = transformEnvVars(
        { KEY: "${PORT:-3000}" },
        "expand",
        { PORT: "8080" },
      );
      expect(env.KEY).toBe("8080");
    });
  });
});
