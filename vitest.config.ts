import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@rails-js/arel/src": path.resolve(__dirname, "packages/arel/src"),
      "@rails-js/arel": path.resolve(__dirname, "packages/arel/src/index.ts"),
      "@rails-js/activemodel": path.resolve(
        __dirname,
        "packages/activemodel/src/index.ts"
      ),
      "@rails-js/activerecord": path.resolve(
        __dirname,
        "packages/activerecord/src/index.ts"
      ),
    },
  },
  test: {
    globals: true,
    include: ["packages/*/src/**/*.test.ts"],
  },
});
