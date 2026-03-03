import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsdown";

const dir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    entry: ["src/index.ts"],
    sourcemap: true,
    shims: true,
    banner: "#!/usr/bin/env node",
    copy: ["src/templates"],
    noExternal: [/@baton-dx\/.*/],
    inlineOnly: false,
    alias: {
        "@baton-dx/core": resolve(dir, "../core/src/index.ts"),
        "@baton-dx/ai-tool-paths": resolve(dir, "../ai-tool-paths/src/index.ts"),
    },
});
