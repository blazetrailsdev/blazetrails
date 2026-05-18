/**
 * ActionView::PathSet
 *
 * An ordered collection of view paths (Resolvers). LookupContext stores its
 * paths in a PathSet. Searches iterate prefixes outer, resolvers inner:
 * given prefixes [A, B] and resolvers [r1, r2], the order is
 * (r1,A), (r2,A), (r1,B), (r2,B).
 *
 * Phase 0c is a data-shape leaf: this file defines the PathSet container and
 * a minimal `PathSetResolver` protocol. The real `Resolver`/`FileSystemResolver`
 * port lands in Phase 1c.
 */

import type { Requested, TemplateDetails } from "./template/details.js";
import type { TemplatePath } from "./template/path.js";

export interface PathSetResolver {
  findAll(
    path: TemplatePath | string,
    prefix: string,
    partial: boolean,
    details: TemplateDetails | Requested,
    detailsKey: unknown,
    locals: ReadonlyArray<string>,
  ): unknown[];
}

export class PathSet implements Iterable<PathSetResolver> {
  readonly paths: ReadonlyArray<PathSetResolver>;

  constructor(paths: ReadonlyArray<PathSetResolver> = []) {
    this.paths = Object.freeze(paths.slice());
  }

  get size(): number {
    return this.paths.length;
  }

  at(idx: number): PathSetResolver | undefined {
    return this.paths[idx];
  }

  includes(resolver: PathSetResolver): boolean {
    return this.paths.includes(resolver);
  }

  *[Symbol.iterator](): IterableIterator<PathSetResolver> {
    for (const r of this.paths) yield r;
  }

  /** Materialize as a plain array (matches Rails `to_ary`). */
  toArray(): PathSetResolver[] {
    return this.paths.slice();
  }

  /** @internal */
  compact(): PathSet {
    return new PathSet(this.paths.filter((p): p is PathSetResolver => p != null));
  }

  /** Concatenate another PathSet or array (returns a new PathSet). */
  plus(other: PathSet | ReadonlyArray<PathSetResolver>): PathSet {
    const arr = Array.isArray(other) ? other : (other as PathSet).paths;
    return new PathSet([...this.paths, ...arr]);
  }

  /**
   * Find one matching template; throws if none match.
   *
   * Note: the concrete return type (`Template`) is defined in Phase 1b. Until
   * then this returns `unknown` to keep this file's dependency surface narrow.
   */
  find(
    path: TemplatePath | string,
    prefixes: string | ReadonlyArray<string>,
    partial: boolean,
    details: TemplateDetails | Requested,
    detailsKey: unknown,
    locals: ReadonlyArray<string>,
  ): unknown {
    const found = this.findAll(path, prefixes, partial, details, detailsKey, locals);
    if (found.length > 0) return found[0];
    throw new Error(
      `Missing template ${String(path)} with prefixes [${[].concat(prefixes as never).join(", ")}]`,
    );
  }

  findAll(
    path: TemplatePath | string,
    prefixes: string | ReadonlyArray<string>,
    partial: boolean,
    details: TemplateDetails | Requested,
    detailsKey: unknown,
    locals: ReadonlyArray<string>,
  ): unknown[] {
    const pfxs = Array.isArray(prefixes) ? prefixes : [prefixes as string];
    for (const prefix of pfxs) {
      for (const resolver of this.paths) {
        const templates = resolver.findAll(path, prefix, partial, details, detailsKey, locals);
        if (templates.length > 0) return templates;
      }
    }
    return [];
  }

  exists(
    path: TemplatePath | string,
    prefixes: string | ReadonlyArray<string>,
    partial: boolean,
    details: TemplateDetails | Requested,
    detailsKey: unknown,
    locals: ReadonlyArray<string>,
  ): boolean {
    return this.findAll(path, prefixes, partial, details, detailsKey, locals).length > 0;
  }
}
