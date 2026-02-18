import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  sourcemap: true,
  shims: true,
  banner: "#!/usr/bin/env node",
  copy: ["src/templates"],
});
