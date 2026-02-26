import { describe, expect, test } from "vitest";
import { transformEnvVars } from "./env-transform.js";

// Literal env-var strings used as test fixtures.
// These intentionally contain ${...} syntax — not template literals.
// biome-ignore lint/suspicious/noTemplateCurlyInString: intentional literal
const HOME_IN = "${HOME}";
// biome-ignore lint/suspicious/noTemplateCurlyInString: intentional literal
const PORT_IN = "${PORT:-3000}";
// biome-ignore lint/suspicious/noTemplateCurlyInString: intentional literal
const FOO_IN = "${FOO}";
// biome-ignore lint/suspicious/noTemplateCurlyInString: intentional literal
const BAR_IN = "${BAR:-baz}";
// biome-ignore lint/suspicious/noTemplateCurlyInString: intentional literal
const MISSING_IN = "${MISSING_VAR}";
// biome-ignore lint/suspicious/noTemplateCurlyInString: intentional literal
const ENV_HOME_OUT = "${env:HOME}";
// biome-ignore lint/suspicious/noTemplateCurlyInString: intentional literal
const ENV_PORT_OUT = "${env:PORT:-3000}";
// biome-ignore lint/suspicious/noTemplateCurlyInString: intentional literal
const ENV_FOO_OUT = "${env:FOO}";
// biome-ignore lint/suspicious/noTemplateCurlyInString: intentional literal
const ENV_BAR_OUT = "${env:BAR:-baz}";

describe("transformEnvVars", () => {
  describe("dollar-brace (pass-through)", () => {
    test("passes VAR syntax through unchanged", () => {
      const { env, warnings } = transformEnvVars({ KEY: HOME_IN }, "dollar-brace");
      expect(env.KEY).toBe(HOME_IN);
      expect(warnings).toHaveLength(0);
    });

    test("passes VAR:-default syntax through unchanged", () => {
      const { env } = transformEnvVars({ KEY: PORT_IN }, "dollar-brace");
      expect(env.KEY).toBe(PORT_IN);
    });
  });

  describe("dollar-env-colon", () => {
    test("transforms dollar-brace VAR to dollar-env-colon VAR", () => {
      const { env, warnings } = transformEnvVars({ KEY: HOME_IN }, "dollar-env-colon");
      expect(env.KEY).toBe(ENV_HOME_OUT);
      expect(warnings).toHaveLength(0);
    });

    test("transforms dollar-brace VAR:-default to dollar-env-colon", () => {
      const { env } = transformEnvVars({ KEY: PORT_IN }, "dollar-env-colon");
      expect(env.KEY).toBe(ENV_PORT_OUT);
    });

    test("handles multiple env vars in record", () => {
      const { env } = transformEnvVars({ A: FOO_IN, B: BAR_IN }, "dollar-env-colon");
      expect(env.A).toBe(ENV_FOO_OUT);
      expect(env.B).toBe(ENV_BAR_OUT);
    });
  });

  describe("env-colon", () => {
    test("transforms dollar-brace VAR to bare env-colon", () => {
      const { env, warnings } = transformEnvVars({ KEY: HOME_IN }, "env-colon");
      expect(env.KEY).toBe("{env:HOME}");
      expect(warnings).toHaveLength(0);
    });

    test("transforms dollar-brace VAR:-default to bare env-colon", () => {
      const { env } = transformEnvVars({ KEY: PORT_IN }, "env-colon");
      expect(env.KEY).toBe("{env:PORT:-3000}");
    });
  });

  describe("expand", () => {
    test("resolves value from processEnv", () => {
      const { env, warnings } = transformEnvVars({ KEY: HOME_IN }, "expand", {
        HOME: "/home/user",
      });
      expect(env.KEY).toBe("/home/user");
      expect(warnings).toHaveLength(0);
    });

    test("uses default when var not set", () => {
      const { env, warnings } = transformEnvVars({ KEY: PORT_IN }, "expand", {});
      expect(env.KEY).toBe("3000");
      expect(warnings).toHaveLength(0);
    });

    test("warns and returns original when var not set and no default", () => {
      const { env, warnings } = transformEnvVars({ KEY: MISSING_IN }, "expand", {});
      expect(env.KEY).toBe(MISSING_IN);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("MISSING_VAR");
    });

    test("prefers env value over default", () => {
      const { env } = transformEnvVars({ KEY: PORT_IN }, "expand", { PORT: "8080" });
      expect(env.KEY).toBe("8080");
    });
  });
});
