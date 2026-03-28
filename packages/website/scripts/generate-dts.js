/**
 * Generates a combined .d.ts file from BlazeTrails package type declarations.
 * This is loaded into Monaco for autocomplete in the Frontiers editor.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../../..");

const packages = ["activerecord", "activemodel", "activesupport", "arel"];
const outputPath = resolve(__dirname, "../src/lib/frontiers/blazetrails.d.ts");

let output = `// Auto-generated BlazeTrails type declarations for Monaco editor.\n// Do not edit manually — regenerate with: node scripts/generate-dts.js\n\n`;

for (const pkg of packages) {
  const distDir = resolve(root, `packages/${pkg}/dist`);
  const indexDts = resolve(distDir, "index.d.ts");

  if (!existsSync(indexDts)) {
    console.warn(`Skipping @blazetrails/${pkg} — no dist/index.d.ts (run pnpm build first)`);
    continue;
  }

  const content = readFileSync(indexDts, "utf-8");
  // Strip import statements (they reference local paths that won't resolve)
  // and re-export everything into a module declaration
  const stripped = content
    .replace(/^import\s+.*$/gm, "")
    .replace(/^export\s*\{[^}]*\}\s*from\s*['"][^'"]*['"];?\s*$/gm, "")
    .replace(/^export\s+\*\s+from\s*['"][^'"]*['"];?\s*$/gm, "")
    .trim();

  if (stripped) {
    output += `declare module "@blazetrails/${pkg}" {\n`;
    for (const line of stripped.split("\n")) {
      output += `  ${line}\n`;
    }
    output += `}\n\n`;
  }

  console.log(`  @blazetrails/${pkg}: ${stripped.split("\n").length} lines`);
}

writeFileSync(outputPath, output);
console.log(`\nWrote ${outputPath}`);
