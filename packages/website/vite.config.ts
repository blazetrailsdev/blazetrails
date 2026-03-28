import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import path from "path";

const stubFile = path.resolve("src/lib/stubs/node.ts");
const cryptoStub = path.resolve("src/lib/stubs/crypto.ts");

function nodeStubs(): Plugin {
  const stubbed = ["better-sqlite3", "pg", "mysql2", "fs", "path", "url"];
  const prefixed = ["node:fs", "node:path", "node:url"];
  const cryptoIds = ["crypto", "node:crypto"];

  return {
    name: "node-stubs",
    enforce: "pre",
    resolveId(id) {
      if (cryptoIds.includes(id)) return cryptoStub;
      if (prefixed.includes(id)) return stubFile;
      for (const mod of stubbed) {
        if (id === mod || id.startsWith(mod + "/")) return stubFile;
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [nodeStubs(), tailwindcss(), sveltekit()],
  optimizeDeps: {
    include: ["sql.js"],
  },
});
