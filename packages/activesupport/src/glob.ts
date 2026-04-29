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

import {
  getFsAsync,
  getPathAsync,
  type FsAdapter,
  type FsDirent,
  type PathAdapter,
} from "./fs-adapter.js";

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
  /**
   * Max additional directory depth the walk may descend below `base`.
   * `-1` = unbounded (pattern contains `**`). Otherwise = number of
   * unconsumed `/` segments in the pattern after `base`. Used to prune
   * subtree recursion.
   */
  maxDepth: number;
}

const GLOB_CHARS = /[*?[\]{}]/;

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
      const base = literalPrefix(p);
      positives.push({ base, re: patternToRegex(p), maxDepth: maxRemainingDepth(p, base) });
    }
  }

  const results = new Set<string>();

  // Walk pass: for patterns with glob metacharacters, recurse from the
  // literal prefix using the iterative walker.
  for (let idx = 0; idx < positives.length; idx++) {
    const positive = positives[idx]!;
    const expandedPattern = expanded.filter((p) => !p.startsWith("!"))[idx]!;
    if (!GLOB_CHARS.test(expandedPattern)) continue; // handled below
    const { base, re, maxDepth } = positive;
    walk(fs, path, base ? path.join(cwd, base) : cwd, base, re, negatives, dot, maxDepth, results);
  }

  // Literal-pattern fast path: for each expanded pattern with no glob
  // metacharacters, a single existence check is enough — no walk.
  for (const p of expanded) {
    if (p.startsWith("!")) continue;
    if (GLOB_CHARS.test(p)) continue;
    if (negatives.some((re) => re.test(p))) continue;
    if (await fs.exists(path.join(cwd, p))) results.add(p);
  }

  return [...results].sort();
}

function walk(
  fs: FsAdapter,
  path: PathAdapter,
  startAbs: string,
  startRel: string,
  positiveRe: RegExp,
  negatives: RegExp[],
  dot: boolean,
  maxDepth: number,
  results: Set<string>,
): void {
  // Iterative DFS via an explicit stack so very deep trees can't blow
  // the JS call stack. depth = number of `/` boundaries crossed below
  // the literal base.
  const stack: { absDir: string; relDir: string; depth: number }[] = [
    { absDir: startAbs, relDir: startRel, depth: 0 },
  ];
  while (stack.length > 0) {
    const { absDir, relDir, depth } = stack.pop()!;
    let entries: FsDirent[];
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!dot && entry.name.startsWith(".")) continue;
      const absPath = path.join(absDir, entry.name);
      const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
      if (positiveRe.test(relPath) && !negatives.some((re) => re.test(relPath))) {
        results.add(relPath);
      }
      // Only recurse when the pattern can still match a deeper path.
      if (entry.isDirectory() && (maxDepth === -1 || depth + 1 <= maxDepth)) {
        stack.push({ absDir: absPath, relDir: relPath, depth: depth + 1 });
      }
    }
  }
}

/**
 * Find the longest literal directory prefix of `pattern` (no glob chars).
 * `app/models/*.rb` → `app/models`. `app/**\/*.rb` → `app`.
 * `*.rb` → `""`. Used to prune the walk to only the matching subtree.
 */
function literalPrefix(pattern: string): string {
  const firstGlob = pattern.search(GLOB_CHARS);
  if (firstGlob === -1) {
    const lastSlash = pattern.lastIndexOf("/");
    return lastSlash === -1 ? "" : pattern.slice(0, lastSlash);
  }
  const lastSlash = pattern.lastIndexOf("/", firstGlob);
  return lastSlash === -1 ? "" : pattern.slice(0, lastSlash);
}

/**
 * Compute the max additional directory depth a walk needs to consider
 * below `base`. Returns `-1` if the pattern contains `**` (unbounded).
 * Otherwise returns the number of `/` boundaries in the unconsumed
 * portion of the pattern.
 */
function maxRemainingDepth(pattern: string, base: string): number {
  if (pattern.includes("**")) return -1;
  const remaining = base ? pattern.slice(base.length + 1) : pattern;
  return (remaining.match(/\//g) ?? []).length;
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
