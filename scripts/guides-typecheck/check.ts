/**
 * Type-check TypeScript code blocks in website guides.
 *
 * Walks `packages/website/docs/guides/**\/*.md`, extracts every
 * ```ts / ```typescript fenced block, injects a preamble that
 * declares common illustrative names (user, post, User, Post, etc.)
 * so short snippets don't need boilerplate, and compiles each block
 * with `tsc --noEmit` against real @blazetrails/* types.
 *
 * Blocks preceded by an HTML comment `<!-- typecheck:skip -->` on
 * the immediately preceding non-blank line are skipped.
 *
 * Exit code is non-zero if any block fails to compile.
 */
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const GUIDES_DIR = path.join(REPO_ROOT, "packages/website/docs/guides");
const TSC = path.join(
  REPO_ROOT,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tsc.cmd" : "tsc",
);

/**
 * Ambient declarations shared across all blocks. Written once as a
 * .d.ts file so they don't conflict when multiple blocks are compiled
 * together.
 */
const GLOBALS_DTS = `
declare global {
  const user: any;
  const post: any;
  const comment: any;
  const tx: any;
  const User: any;
  const Post: any;
  const Comment: any;
  type AnyRecord = any;
}
export {};
`.trimStart();

const BLOCK_SUFFIX = "\nexport {};\n";

interface Block {
  file: string;
  startLine: number;
  code: string;
  skip: boolean;
}

function extractBlocks(filePath: string): Block[] {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const blocks: Block[] = [];
  let inBlock = false;
  let blockStart = 0;
  let blockLines: string[] = [];
  let blockSkip = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inBlock) {
      const m = /^```(ts|typescript)(\s|$)/.exec(line);
      if (m) {
        inBlock = true;
        blockStart = i + 1;
        blockLines = [];
        blockSkip = false;
        for (let j = i - 1; j >= 0; j--) {
          const prev = lines[j].trim();
          if (prev === "") continue;
          if (prev.includes("<!-- typecheck:skip -->")) blockSkip = true;
          break;
        }
      }
    } else {
      if (/^```\s*$/.test(line)) {
        blocks.push({
          file: filePath,
          startLine: blockStart,
          code: blockLines.join("\n"),
          skip: blockSkip,
        });
        inBlock = false;
      } else {
        blockLines.push(line);
      }
    }
  }
  return blocks;
}

function writeTsconfig(tmpDir: string): string {
  const tsconfigPath = path.join(tmpDir, "tsconfig.json");
  const config = {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "bundler",
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      esModuleInterop: true,
      resolveJsonModule: true,
      allowSyntheticDefaultImports: true,
      isolatedModules: true,
      typeRoots: [path.join(REPO_ROOT, "node_modules/@types")],
    },
    include: ["globals.d.ts", "blocks/**/*.ts"],
  };
  fs.writeFileSync(tsconfigPath, JSON.stringify(config, null, 2));
  return tsconfigPath;
}

function main(): void {
  if (!fs.existsSync(GUIDES_DIR)) {
    console.error(`Guides directory not found: ${GUIDES_DIR}`);
    process.exit(1);
  }

  const mdFiles = fs
    .readdirSync(GUIDES_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.join(GUIDES_DIR, f));

  const allBlocks: Block[] = [];
  for (const file of mdFiles) {
    allBlocks.push(...extractBlocks(file));
  }

  const checked = allBlocks.filter((b) => !b.skip);
  const skipped = allBlocks.length - checked.length;

  if (checked.length === 0) {
    console.log(
      `No TypeScript code blocks to check. (${allBlocks.length} total, ${skipped} skipped.)`,
    );
    return;
  }

  const tmpParent = path.join(SCRIPT_DIR, ".tmp");
  fs.mkdirSync(tmpParent, { recursive: true });
  const tmpRoot = fs.mkdtempSync(path.join(tmpParent, "run-"));
  const blocksDir = path.join(tmpRoot, "blocks");
  fs.mkdirSync(blocksDir);
  fs.writeFileSync(path.join(tmpRoot, "globals.d.ts"), GLOBALS_DTS);
  writeTsconfig(tmpRoot);

  const blockPaths: { block: Block; tmpPath: string }[] = [];
  checked.forEach((block, idx) => {
    const rel = path.relative(REPO_ROOT, block.file).replace(/[^\w]/g, "_");
    const tmpName = `${rel}__L${block.startLine}__${idx}.ts`;
    const tmpPath = path.join(blocksDir, tmpName);
    fs.writeFileSync(tmpPath, block.code + BLOCK_SUFFIX);
    blockPaths.push({ block, tmpPath });
  });

  console.log(
    `Type-checking ${checked.length} code block${checked.length === 1 ? "" : "s"} from ${mdFiles.length} guide${mdFiles.length === 1 ? "" : "s"}${skipped ? ` (${skipped} skipped)` : ""}…`,
  );

  const result = spawnSync(TSC, ["-p", path.join(tmpRoot, "tsconfig.json")], {
    encoding: "utf8",
  });

  const output = (result.stdout ?? "") + (result.stderr ?? "");
  if (result.status === 0) {
    console.log(`✓ All ${checked.length} code blocks type-check cleanly.`);
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    return;
  }

  const remappedOutput = output.replace(
    /(?:\S+[\/\\])?blocks[\/\\](\S+?)__L(\d+)__\d+\.ts(\((\d+),(\d+)\))?/g,
    (_match, _name, originalStart, _paren, lineOffsetStr, col) => {
      const lineOffset = lineOffsetStr ? parseInt(lineOffsetStr, 10) : 1;
      const absoluteLine = parseInt(originalStart, 10) + lineOffset - 1;
      const match = blockPaths.find((p) => p.tmpPath.includes(`__L${originalStart}__`));
      const guide = match ? path.relative(REPO_ROOT, match.block.file) : "<unknown>";
      return col ? `${guide}:${absoluteLine}:${col}` : `${guide}:${absoluteLine}`;
    },
  );

  console.error(remappedOutput);
  console.error(`✗ Guide code block type-check failed.`);
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  process.exit(result.status ?? 1);
}

main();
