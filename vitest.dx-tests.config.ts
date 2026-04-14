import { defineConfig } from "vitest/config";
import path from "path";

// Separate config for DX type tests. These are type-level assertions — no
// runtime code runs. Vitest's typecheck mode compiles each *.test-d.ts and
// reports any type errors as test failures.
export default defineConfig({
  resolve: {
    alias: {
      "@blazetrails/activesupport": path.resolve(__dirname, "packages/activesupport/src/index.ts"),
      "@blazetrails/arel": path.resolve(__dirname, "packages/arel/src/index.ts"),
      "@blazetrails/activemodel": path.resolve(__dirname, "packages/activemodel/src/index.ts"),
      "@blazetrails/activerecord": path.resolve(__dirname, "packages/activerecord/src/index.ts"),
    },
  },
  test: {
    include: [],
    typecheck: {
      enabled: true,
      only: true,
      include: ["packages/*/dx-tests/**/*.test-d.ts"],
      tsconfig: "./packages/activerecord/dx-tests/tsconfig.json",
    },
  },
});
