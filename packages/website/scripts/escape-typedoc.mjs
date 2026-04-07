/**
 * Post-processes typedoc-generated markdown to be VitePress-compatible.
 * Escapes raw HTML tags that Vue's template compiler would choke on.
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

// Matches HTML-like tags that aren't inside backtick code spans or fenced code blocks.
// We wrap each markdown file's content in a raw block to prevent Vue compilation.
for await (const file of walkMd(apiDir)) {
  let content = await readFile(file, "utf8");

  // Extract frontmatter if present
  let frontmatter = "";
  if (content.startsWith("---")) {
    const end = content.indexOf("---", 3);
    if (end !== -1) {
      frontmatter = content.slice(0, end + 3) + "\n";
      content = content.slice(end + 3);
    }
  }

  // Wrap the body in <div v-pre> to prevent Vue template compilation
  await writeFile(file, frontmatter + "<div v-pre>\n\n" + content.trimStart() + "\n\n</div>\n");
}

console.log("Escaped typedoc output for VitePress compatibility.");
