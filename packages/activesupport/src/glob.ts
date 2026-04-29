/**
 * Glob matching for fs-adapter.
 *
 * Pattern dialect — node/picomatch-style subset:
 *   `**`      match zero or more directories (when followed by `/`) or any
 *             characters (otherwise)
 *   `*`       match anything except `/`
 *   `?`       match any single char except `/`
 *   `[abc]`   character class
 *   `{a,b,c}` brace expansion
 *   leading `!`  negation (post-filter)
 *
 * Not aiming for Ruby `Dir.glob` parity. Patterns that don't translate
 * cleanly should be rewritten when ported.
 */

import { getFsAsync, getPathAsync, type FsAdapter, type PathAdapter } from "./fs-adapter.js";

export interface GlobOptions {
  cwd?: string;
  /** Include dotfiles. Default false. */
  dot?: boolean;
}

interface CompiledPattern {
  /** Literal directory prefix to start the walk from (relative to cwd). */
  base: string;
  /** Regex applied against the path relative to cwd. */
  re: RegExp;
}

export async function glob(pattern: string, opts: GlobOptions = {}): Promise<string[]> {
  // Use async resolution so this works in pure Node ESM without callers
  // pre-registering an adapter. (sync getFs() relies on CommonJS require.)
  const fs = await getFsAsync();
  const path = await getPathAsync();
  const cwd = opts.cwd ?? fs.cwd();
  const dot = opts.dot ?? false;

  const expanded = expandBraces(pattern);
  const positives: CompiledPattern[] = [];
  const negatives: RegExp[] = [];
  for (const p of expanded) {
    if (p.startsWith("!")) {
      negatives.push(patternToRegex(p.slice(1)));
    } else {
      positives.push({ base: literalPrefix(p), re: patternToRegex(p) });
    }
  }

  const results = new Set<string>();

  for (const { base, re } of positives) {
    const startAbs = base ? path.join(cwd, base) : cwd;
    walk(fs, path, startAbs, base, re, negatives, dot, results);
  }

  return [...results].sort();
}

function walk(
  fs: FsAdapter,
  path: PathAdapter,
  absDir: string,
  relDir: string,
  positiveRe: RegExp,
  negatives: RegExp[],
  dot: boolean,
  results: Set<string>,
): void {
  let entries;
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!dot && entry.name.startsWith(".")) continue;
    const absPath = path.join(absDir, entry.name);
    const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
    if (positiveRe.test(relPath) && !negatives.some((re) => re.test(relPath))) {
      results.add(relPath);
    }
    if (entry.isDirectory()) walk(fs, path, absPath, relPath, positiveRe, negatives, dot, results);
  }
}

/**
 * Find the longest literal directory prefix of `pattern` (no glob chars).
 * `app/models/*.rb` → `app/models`. `app/**\/*.rb` → `app`.
 * `*.rb` → `""`. Used to prune the walk to only the matching subtree.
 */
function literalPrefix(pattern: string): string {
  const firstGlob = pattern.search(/[*?[{]/);
  if (firstGlob === -1) {
    const lastSlash = pattern.lastIndexOf("/");
    return lastSlash === -1 ? "" : pattern.slice(0, lastSlash);
  }
  const lastSlash = pattern.lastIndexOf("/", firstGlob);
  return lastSlash === -1 ? "" : pattern.slice(0, lastSlash);
}

function expandBraces(pattern: string): string[] {
  const match = /\{([^{}]+)\}/.exec(pattern);
  if (!match) return [pattern];
  const before = pattern.slice(0, match.index);
  const after = pattern.slice(match.index + match[0].length);
  const choices = match[1].split(",");
  const expanded: string[] = [];
  for (const choice of choices) {
    expanded.push(...expandBraces(before + choice + after));
  }
  return expanded;
}

function patternToRegex(pattern: string): RegExp {
  let re = "^";
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i]!;
    if (c === "*") {
      if (pattern[i + 1] === "*") {
        if (pattern[i + 2] === "/") {
          re += "(?:.*/)?";
          i += 3;
          continue;
        }
        re += ".*";
        i += 2;
        continue;
      }
      re += "[^/]*";
      i++;
    } else if (c === "?") {
      re += "[^/]";
      i++;
    } else if (c === "[") {
      const end = pattern.indexOf("]", i);
      if (end === -1) {
        re += "\\[";
        i++;
      } else {
        re += pattern.slice(i, end + 1);
        i = end + 1;
      }
    } else if ("^$.+()|/\\{}".includes(c)) {
      // Escape regex metachars including `{` and `}` — leftover braces
      // (e.g. unbalanced) reach this loop after `expandBraces` has run.
      re += `\\${c}`;
      i++;
    } else {
      re += c;
      i++;
    }
  }
  re += "$";
  return new RegExp(re);
}
