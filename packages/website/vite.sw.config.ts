import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function pkgAlias(name: string, entry: string) {
  return {
    find: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
    replacement: path.resolve(__dirname, entry),
  };
}

export default defineConfig({
  resolve: {
    alias: [
      // Subpath imports must come before the base alias
      {
        find: /^@blazetrails\/activesupport\/(.+)$/,
        replacement: path.resolve(__dirname, "../activesupport/src/$1.ts"),
      },
      pkgAlias("@blazetrails/activesupport", "../activesupport/src/index.ts"),
      pkgAlias("@blazetrails/arel", "../arel/src/index.ts"),
      pkgAlias("@blazetrails/activemodel", "../activemodel/src/index.ts"),
      pkgAlias("@blazetrails/activerecord/adapter", "../activerecord/src/adapter.ts"),
      pkgAlias("@blazetrails/activerecord/migration", "../activerecord/src/migration.ts"),
      pkgAlias("@blazetrails/activerecord", "../activerecord/src/index.ts"),
      pkgAlias("@blazetrails/rack", "../rack/src/index.ts"),
      pkgAlias("@blazetrails/actionview", "../actionview/src/index.ts"),
      pkgAlias("@blazetrails/actionpack", "../actionpack/src/index.ts"),
      pkgAlias("@blazetrails/railties/generators", "../railties/src/generators/index.ts"),
    ],
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/lib/frontiers/sandbox-sw.ts"),
      formats: ["iife"],
      name: "SandboxSW",
      fileName: () => "sandbox-sw.js",
    },
    outDir: path.resolve(__dirname, "static"),
    emptyOutDir: false,
    rollupOptions: {
      external: (id: string) =>
        id === "sql.js" ||
        id.startsWith("node:") ||
        ["fs", "path", "crypto", "url", "child_process", "util", "events", "stream"].includes(id),
      output: {
        globals: {
          "sql.js": "initSqlJs",
        },
      },
    },
  },
});
