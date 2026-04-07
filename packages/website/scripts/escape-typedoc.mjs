/**
 * Post-processes typedoc-generated markdown to be VitePress-compatible.
 *
 * VitePress compiles markdown as Vue SFC templates. The Vue SFC parser must
 * successfully parse the entire template before any directives (like v-pre)
 * take effect. TypeScript generics (Array<T>), JSDoc HTML examples (<script>,
 * <br>), and type signatures all produce angle brackets that break parsing.
 *
 * Fix: escape all `<` outside fenced code blocks to `&lt;`, so nothing
 * looks like an HTML tag to the Vue parser.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const apiDir = join(import.meta.dirname, "..", "docs", "api");

async function* walkMd(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walkMd(full);
    else if (entry.name.endsWith(".md")) yield full;
  }
}

function escapeForVue(content) {
  const lines = content.split("\n");
  let inFencedBlock = false;
  const result = [];

  for (const line of lines) {
    if (line.startsWith("```")) {
      inFencedBlock = !inFencedBlock;
      result.push(line);
      continue;
    }

    if (inFencedBlock) {
      result.push(line);
      continue;
    }

    result.push(line.replace(/</g, "&lt;"));
  }

  return result.join("\n");
}

let count = 0;
for await (const file of walkMd(apiDir)) {
  const original = await readFile(file, "utf8");
  const escaped = escapeForVue(original);
  await writeFile(file, escaped);
  if (escaped !== original) count++;
}

console.log(`Escaped ${count} files for VitePress compatibility.`);
