/**
 * ActionView::OptimizedFileSystemResolver
 *
 * Rails' default filesystem resolver. Caches `find` lookup results keyed
 * by `(name, prefix, format, extensions)` so repeated lookups don't
 * re-`stat` the filesystem on every render. Call `clearCache()` to
 * invalidate (or `DetailsKey.clear()` which walks `PathRegistry` and
 * calls `clearCache()` on every live resolver).
 */

import type { Template } from "../template.js";
import { FileSystemResolver } from "./file-system-resolver.js";

export class OptimizedFileSystemResolver extends FileSystemResolver {
  private cache = new Map<string, Template | null>();

  override find(
    name: string,
    prefix: string,
    format: string,
    extensions: string[],
  ): Template | null {
    const key = `${prefix}\0${name}\0${format}\0${extensions.join(",")}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;
    const result = super.find(name, prefix, format, extensions);
    this.cache.set(key, result);
    return result;
  }

  /** @internal */
  override clearCache(): void {
    this.cache.clear();
  }
}
