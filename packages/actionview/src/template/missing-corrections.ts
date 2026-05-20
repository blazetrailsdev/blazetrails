/**
 * Mirrors `ActionView::MissingTemplate#corrections` from
 * `actionview/lib/action_view/template/error.rb`. Splits candidate paths
 * into directory + basename, scores each pair with Jaro distance (using
 * Rails' cached-distance trick), and returns the top six. Negated scores
 * follow Ruby (where lower = better after `-Jaro.distance(...)`).
 */

import { jaroDistance } from "@blazetrails/did-you-mean";

interface ResultEntry {
  path: string;
  score: number;
}

function dirname(p: string): string {
  const i = p.lastIndexOf("/");
  return i < 0 ? "" : p.slice(0, i);
}

function basename(p: string): string {
  const i = p.lastIndexOf("/");
  return i < 0 ? p : p.slice(i + 1);
}

function isPartial(p: string): boolean {
  return basename(p).startsWith("_");
}

function score(a: string, b: string, cache: Map<string, number>): number {
  const key = `${a}\x00${b}`;
  let cached = cache.get(key);
  if (cached === undefined) {
    cached = -jaroDistance(a, b);
    cache.set(key, cached);
  }
  return cached;
}

/**
 * @param candidates - all known template paths (e.g. "users/_form.html.erb").
 * @param path - the basename being looked up (e.g. "show").
 * @param prefixes - controller prefixes to search under (e.g. ["users"]).
 * @param partial - whether we're looking up a partial.
 */
export function correctTemplatePaths(
  candidates: ReadonlyArray<string>,
  path: string,
  prefixes: ReadonlyArray<string>,
  partial: boolean,
): string[] {
  const filtered = candidates.filter((c) => isPartial(c) === partial);

  const filesByDir = new Map<string, string[]>();
  for (const c of filtered) {
    const dir = dirname(c);
    const base = basename(c);
    const list = filesByDir.get(dir);
    if (list) list.push(base);
    else filesByDir.set(dir, [base]);
  }

  for (const prefix of prefixes) {
    if (filesByDir.get(prefix)?.includes(path)) return [];
  }

  const cache = new Map<string, number>();

  const dirsWithScore: Array<{ dirname: string; dirweight: number }> = [];
  for (const dir of filesByDir.keys()) {
    let best = Infinity;
    for (const prefix of prefixes) {
      const s = score(prefix, dir, cache);
      if (s < best) best = s;
    }
    dirsWithScore.push({ dirname: dir, dirweight: best });
  }
  dirsWithScore.sort((a, b) => a.dirweight - b.dirweight);

  const SIZE = 6;
  const results: ResultEntry[] = [];

  function shouldRecord(s: number): boolean {
    if (results.length < SIZE) return true;
    return s < results[results.length - 1]!.score;
  }

  for (const { dirname: dir, dirweight } of dirsWithScore) {
    if (!shouldRecord(dirweight - 1.0)) continue;
    for (const file of filesByDir.get(dir)!) {
      const fileweight = score(path, file, cache);
      const total = dirweight + fileweight;
      if (shouldRecord(total)) {
        results.push({ path: `${dir}/${file}`, score: total });
        results.sort((a, b) => a.score - b.score);
        if (results.length > SIZE) results.pop();
      }
    }
  }

  const paths = results.map((r) => r.path);
  if (partial) {
    return paths.map((p) => p.replace(/_([^/]+)$/, "$1"));
  }
  return paths;
}
