/**
 * ActionDispatch::Http::FilterRedirect
 *
 * Port of `actionpack/lib/action_dispatch/http/filter_redirect.rb`. Rails
 * mixes this into `ActionDispatch::Response`; the redirect filter list
 * lives at `env["action_dispatch.redirect_filter"]`.
 *
 * Exposed as `this`-typed mixin functions per CLAUDE.md.
 */

import type { ParameterFilter } from "@blazetrails/activesupport";

/** @internal */
export const FILTERED = "[FILTERED]";

/**
 * Minimal host surface required by the {@link FilterRedirect} mixin.
 * Mirrors the methods Rails' `Http::FilterRedirect` calls on `self`.
 */
export interface FilterRedirectHost {
  location: string;
  request: FilterRedirectRequest | null | undefined;
}

/** Subset of the Request surface needed by {@link FilterRedirect}. */
export interface FilterRedirectRequest {
  getHeader(key: string): unknown;
  parameterFilter(): ParameterFilter;
}

/** @internal */
export function filteredLocation(this: FilterRedirectHost): string {
  return locationFilterMatch.call(this) ? FILTERED : parameterFilteredLocation.call(this);
}

/** @internal */
export function locationFilters(this: FilterRedirectHost): Array<string | RegExp> {
  if (this.request) {
    return (
      (this.request.getHeader("action_dispatch.redirect_filter") as
        | Array<string | RegExp>
        | undefined) ?? []
    );
  }
  return [];
}

/** @internal */
export function locationFilterMatch(this: FilterRedirectHost): boolean {
  const loc = this.location;
  return locationFilters.call(this).some((filter) => {
    if (typeof filter === "string") return loc.includes(filter);
    if (filter instanceof RegExp) return filter.test(loc);
    return false;
  });
}

/** @internal */
export function parameterFilteredLocation(this: FilterRedirectHost): string {
  try {
    const url = new URL(this.location);
    if (url.search.length > 1 && this.request) {
      const filter = this.request.parameterFilter();
      const query = url.search.slice(1);
      const parts = query.split(/([&;])/);
      const filteredParts = parts.map((part) => {
        if (part.includes("=")) {
          const eq = part.indexOf("=");
          const key = part.slice(0, eq);
          const value = part.slice(eq + 1);
          const filtered = filter.filter({ [key]: value });
          const firstKey = Object.keys(filtered)[0];
          return `${firstKey}=${filtered[firstKey] as string}`;
        }
        return part;
      });
      url.search = `?${filteredParts.join("")}`;
    }
    return url.toString();
  } catch {
    return FILTERED;
  }
}
