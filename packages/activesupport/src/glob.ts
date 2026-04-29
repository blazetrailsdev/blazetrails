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

import { getFs, getPath } from "./fs-adapter.js";

export interface GlobOptions {
  cwd?: string;
  /** Include dotfiles. Default false. */
  dot?: boolean;
}

export async function glob(pattern: string, opts: GlobOptions = {}): Promise<string[]> {
  const fs = getFs();
  const path = getPath();
  const cwd = opts.cwd ?? fs.cwd();
  const dot = opts.dot ?? false;

  const expanded = expandBraces(pattern);
  const positives: RegExp[] = [];
  const negatives: RegExp[] = [];
  for (const p of expanded) {
    if (p.startsWith("!")) negatives.push(patternToRegex(p.slice(1)));
    else positives.push(patternToRegex(p));
  }

  const results = new Set<string>();

  function walk(absDir: string, relDir: string): void {
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
      const matches =
        positives.some((re) => re.test(relPath)) && !negatives.some((re) => re.test(relPath));
      if (matches) results.add(relPath);
      if (entry.isDirectory()) walk(absPath, relPath);
    }
  }

  walk(cwd, "");
  return [...results].sort();
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
    } else if ("^$.+()|/\\".includes(c)) {
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
