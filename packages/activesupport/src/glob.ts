/**
 * Glob matching for fs-adapter.
 *
 * Pattern dialect — node/picomatch-style subset:
 *   `**`      directory wildcard, ONLY when it forms a complete path
 *             segment (preceded by start or `/`, followed by `/` or
 *             end). In-segment occurrences (e.g. `foo**bar`) collapse
 *             to plain `*` semantics — they do NOT cross `/` boundaries.
 *   `*`       match anything except `/`
 *   `?`       match any single char except `/`
 *   `[abc]`   character class (cannot match `/`; empty `[]` is treated
 *             as a literal pair). Invalid contents (e.g. an out-of-order
 *             range like `[z-a]`) propagate the underlying
 *             `new RegExp()` SyntaxError. Glob patterns in this repo
 *             are author-controlled, so no defensive guard.
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
  /** The original (post-brace-expansion) pattern string. */
  source: string;
  /** Literal directory prefix to start the walk from (relative to cwd). */
  base: string;
  /** Regex applied against the path relative to cwd. */
  re: RegExp;
  /**
   * Max additional directory depth the walk may descend below `base`.
   * `-1` = unbounded (pattern contains a `**` directory segment).
   * Otherwise = number of unconsumed `/` segments in the pattern after
   * `base`. Used to prune subtree recursion.
   */
  maxDepth: number;
  /**
   * Whether the walk for this pattern should include dot entries even
   * if `opts.dot` is false. Picomatch-style: a pattern that explicitly
   * references a dot segment (e.g. `**` + `/.hidden`, `.config/` + `**`)
   * opts itself in.
   */
  allowDot: boolean;
}

/**
 * Detect whether a (post-brace-expansion) pattern has real glob
 * semantics — `*`, `?`, or a balanced `[...]` character class.
 *
 * Unbalanced `{`, `}`, `[`, or `]` are treated as literals by
 * `patternToRegex` (they get escaped), so they should not push a
 * pattern onto the walk path or prevent a useful `literalPrefix`.
 *
 * `expandBraces` has already replaced balanced `{...}` groups before
 * this is called, so leftover `{`/`}` are necessarily unbalanced.
 */
function hasGlobSemantics(pattern: string): boolean {
  if (/[*?]/.test(pattern)) return true;
  const open = pattern.indexOf("[");
  if (open === -1) return false;
  const close = pattern.indexOf("]", open + 1);
  // Empty `[]` is treated as a literal pair by `patternToRegex`, so it
  // shouldn't count as glob semantics here either (otherwise it would
  // route to the walk path instead of the literal fast path).
  return close !== -1 && close > open + 1;
}

/**
 * Index of the first character with real glob semantics, or `-1` if
 * the pattern is effectively literal. Used by `literalPrefix` to find
 * the deepest directory we can pin the walk to.
 */
function firstGlobIndex(pattern: string): number {
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "*" || c === "?") return i;
    if (c === "[") {
      const close = pattern.indexOf("]", i + 1);
      // Match patternToRegex: empty `[]` is literal, not a class.
      if (close !== -1 && close > i + 1) return i;
    }
  }
  return -1;
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
    // Skip empty patterns produced by brace expansion edge cases like
    // `{a,}` or `{,foo}`. Without this, the literal fast path would
    // statSync(cwd) and add "" to results — surprising and useless.
    if (p === "" || p === "!") continue;

    // Validate each expanded branch (after stripping leading `!`)
    // rather than only the pre-expansion pattern. Brace expansion can
    // otherwise smuggle unsafe forms past validation, e.g.
    // `{..,foo}/bar` → `../bar` (escapes cwd), `{/etc/passwd,foo}`
    // → `/etc/passwd` (absolute, would `path.join(cwd, "/etc/...")`).
    //
    // Patterns are relative to `cwd` by contract. Both `/` and `\` are
    // treated as separators so Windows-flavored PathAdapters can't slip
    // past. Rejected: leading `/` or `\`; any drive prefix
    // `<letter>:` (covers both `C:/foo` and `C:foo`); any `..` as a
    // complete segment regardless of separator.
    const candidate = p.startsWith("!") ? p.slice(1) : p;
    if (/^[/\\]/.test(candidate) || /^[a-zA-Z]:/.test(candidate)) {
      throw new Error(
        `glob: absolute patterns are not supported (got ${JSON.stringify(candidate)}); use a path relative to \`cwd\``,
      );
    }
    if (/(^|[/\\])\.\.([/\\]|$)/.test(candidate)) {
      throw new Error(
        `glob: '..' segments are not supported (got ${JSON.stringify(candidate)}); use a path relative to \`cwd\``,
      );
    }
    // Reject mid-pattern backslashes outside character classes. The
    // rest of the implementation (literalPrefix, maxRemainingDepth,
    // walk()'s relPath, allowDot detection) only understands `/` as
    // the separator, so a pattern like `app\models\*.rb` would silently
    // never match anything. Backslashes inside `[...]` are allowed —
    // they're escape characters there.
    if (hasBackslashSeparator(candidate)) {
      throw new Error(
        `glob: backslashes outside character classes are not supported (got ${JSON.stringify(candidate)}); use '/' as the path separator`,
      );
    }

    if (p.startsWith("!")) {
      negatives.push(patternToRegex(p.slice(1)));
    } else {
      const base = literalPrefix(p);
      positives.push({
        source: p,
        base,
        re: patternToRegex(p),
        maxDepth: maxRemainingDepth(p, base),
        allowDot: dot || /(^|\/)\./.test(p),
      });
    }
  }

  const results = new Set<string>();

  // Walk pass: for patterns with real glob semantics, recurse from the
  // literal prefix using the iterative walker.
  for (const positive of positives) {
    if (!hasGlobSemantics(positive.source)) continue;
    const { base, re, maxDepth, allowDot } = positive;
    walk(
      fs,
      path,
      base ? path.join(cwd, base) : cwd,
      base,
      re,
      negatives,
      allowDot,
      maxDepth,
      results,
    );
  }

  // Literal-pattern fast path: a single existence check, no walk. Use
  // statSync with explicit error filtering rather than fs.exists, so
  // unexpected errors (e.g. EACCES) propagate instead of being silently
  // converted to "not found" — keeping behavior consistent with walk()
  // regardless of how a custom adapter implements `exists`.
  for (const positive of positives) {
    if (hasGlobSemantics(positive.source)) continue;
    if (negatives.some((re) => re.test(positive.source))) continue;
    if (literalExists(fs, path.join(cwd, positive.source))) results.add(positive.source);
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
    } catch (err) {
      // Only swallow expected absence errors. Permission errors and
      // other unexpected failures should propagate so callers see them
      // instead of silently getting incomplete results.
      const code = (err as { code?: string } | null)?.code;
      if (code === "ENOENT" || code === "ENOTDIR") continue;
      throw err;
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
 * Find the longest literal directory prefix of `pattern` (no real glob
 * chars). Unbalanced `{`/`}`/`[`/`]` are treated as literals.
 *
 * `app/models/*.rb` → `app/models`. `app/` + `**` + `/*.rb` → `app`.
 * `*.rb` → `""`. `foo{bar.rb` → `""` (whole pattern is literal, but
 * has no `/` to split on).
 *
 * Used to prune the walk to only the matching subtree.
 */
function literalPrefix(pattern: string): string {
  const firstGlob = firstGlobIndex(pattern);
  if (firstGlob === -1) {
    const lastSlash = pattern.lastIndexOf("/");
    return lastSlash === -1 ? "" : pattern.slice(0, lastSlash);
  }
  const lastSlash = pattern.lastIndexOf("/", firstGlob);
  return lastSlash === -1 ? "" : pattern.slice(0, lastSlash);
}

/**
 * Compute the max additional directory depth a walk needs to consider
 * below `base`. Returns `-1` only if the pattern contains a `**` segment
 * (the directory wildcard form: a path segment that is exactly `**`).
 * Otherwise returns the number of `/` boundaries in the unconsumed
 * portion of the pattern.
 *
 * In-segment occurrences like `foo**bar` are treated as plain `*`
 * (single-segment) and don't grant unbounded depth.
 */
function maxRemainingDepth(pattern: string, base: string): number {
  if (pattern.split("/").includes("**")) return -1;
  const remaining = base ? pattern.slice(base.length + 1) : pattern;
  return countSeparatorsOutsideClasses(remaining);
}

/**
 * Count `/` characters in `s`, skipping any inside a balanced `[...]`
 * character class. Without this, a pattern like `app/[/]bar` would
 * count 2 separators (one real, one inside the class) and inflate
 * `maxDepth`, defeating the intended subtree pruning.
 */
function countSeparatorsOutsideClasses(s: string): number {
  let count = 0;
  let inClass = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (!inClass) {
      if (c === "[" && s.indexOf("]", i + 1) !== -1) inClass = true;
      else if (c === "/") count++;
    } else if (c === "]") {
      inClass = false;
    }
  }
  return count;
}

/**
 * Scan `pattern` for a backslash outside any balanced `[...]` character
 * class. Backslashes inside classes are escape characters (e.g.
 * `[\\b]`) and are allowed; backslashes outside would be path
 * separators which the rest of the implementation does not support.
 */
function hasBackslashSeparator(pattern: string): boolean {
  let inClass = false;
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (!inClass) {
      if (c === "[" && pattern.indexOf("]", i + 1) !== -1) inClass = true;
      else if (c === "\\") return true;
    } else if (c === "]") {
      inClass = false;
    }
  }
  return false;
}

function literalExists(fs: FsAdapter, path: string): boolean {
  try {
    fs.statSync(path);
    return true;
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "ENOENT" || code === "ENOTDIR") return false;
    throw err;
  }
}

// Standard regex-metacharacter escape. Used to render literal characters
// inside the compiled glob pattern without ambiguity (in particular, a
// literal backslash must become \\\\ in the regex source).
const REGEX_META = /[.*+?^${}()|[\]\\/]/;

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
      // `**` is the directory wildcard ONLY when it forms a complete
      // path segment: preceded by start-of-pattern or `/`, and followed
      // by `/` or end-of-pattern. In-segment occurrences (`foo**bar`)
      // collapse to plain `*` semantics (match within a single segment).
      const isStarStar = pattern[i + 1] === "*";
      const beforeIsBoundary = i === 0 || pattern[i - 1] === "/";
      const after = pattern[i + 2];
      const afterIsBoundary = after === "/" || after === undefined;
      if (isStarStar && beforeIsBoundary && afterIsBoundary) {
        if (after === "/") {
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
      } else if (end === i + 1) {
        // Empty character class `[]` — treat both `[` and `]` as
        // literals so the compiled regex stays valid (some engines
        // reject `[]`, and even when accepted it matches nothing,
        // surprising callers who passed a literal-looking pattern).
        re += "\\[\\]";
        i += 2;
      } else {
        // Constrain bracket expressions to non-slash to match the
        // segment-boundary semantics of `*` / `?`. Without this,
        // `a[/]b` would match `a/b`, crossing path boundaries.
        // Also escape any backslash inside the class so glob users
        // can't produce an invalid regex via `[\b]` etc. (filesystem
        // paths don't carry meaningful backslashes anyway).
        const classBody = pattern.slice(i, end + 1).replace(/\\/g, "\\\\");
        re += `(?![/])${classBody}`;
        i = end + 1;
      }
    } else if (REGEX_META.test(c)) {
      // Escape regex metachars including `{`/`}` (leftover unbalanced
      // braces after expandBraces) and `\` (which must become `\\\\` in
      // the compiled regex source to match a single literal backslash).
      re += c === "\\" ? "\\\\" : `\\${c}`;
      i++;
    } else {
      re += c;
      i++;
    }
  }
  re += "$";
  return new RegExp(re);
}
