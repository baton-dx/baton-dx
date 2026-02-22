import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "@baton-dx/ai-tool-paths",
          root: "./packages/ai-tool-paths",
          environment: "node",
          include: ["src/**/*.test.ts"],
          coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
          },
        },
      },
      {
        test: {
          name: "@baton-dx/core",
          root: "./packages/core",
          environment: "node",
          include: ["src/**/*.test.ts"],
          coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
          },
        },
      },
      {
        test: {
          name: "@baton-dx/cli",
          root: "./packages/cli",
          environment: "node",
          include: ["src/**/*.test.ts"],
          coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
          },
        },
      },
    ],
  },
});
