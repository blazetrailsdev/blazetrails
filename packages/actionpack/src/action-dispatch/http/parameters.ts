/**
 * ActionDispatch::Http::Parameters
 *
 * Port of `actionpack/lib/action_dispatch/http/parameters.rb`. Provides the
 * parameter-parser registry, the {@link ParseError} class, and the host
 * functions (`parameters`, `pathParameters`, `setPathParameters`,
 * `parseFormattedParameters`) that Rails mixes into `ActionDispatch::Request`
 * via `extend ActiveSupport::Concern`.
 *
 * In Ruby these are mixed into `Request`. In TypeScript we expose them as
 * `this`-typed functions per the mixin convention in CLAUDE.md so they can be
 * assigned directly onto the host class.
 */

import { MimeType } from "./mime-type.js";

export const PARAMETERS_KEY = "action_dispatch.request.path_parameters";

/** Function that parses a raw request body into a params hash. */
export type ParameterParser = (rawPost: string) => Record<string, unknown>;

/** Map of MIME symbol → parser. */
export type ParameterParsers = Record<string, ParameterParser>;

/**
 * Default parser map. Mirrors the Ruby `DEFAULT_PARSERS` constant: the JSON
 * parser wraps non-Hash payloads in `{ _json: data }`.
 */
export const DEFAULT_PARSERS: ParameterParsers = {
  [MimeType.JSON.symbol]: (rawPost: string) => {
    const data = JSON.parse(rawPost);
    if (data !== null && typeof data === "object" && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
    return { _json: data };
  },
};

/**
 * Raised when raw data from the request cannot be parsed by the parser
 * defined for the request's content MIME type.
 */
export class ParseError extends Error {
  constructor(message?: string) {
    super(message ?? (typeof globalThis !== "undefined" ? "Parse error" : ""));
    this.name = "ActionDispatch::Http::Parameters::ParseError";
  }
}

/**
 * Minimal host surface required by the {@link Parameters} mixin functions.
 * Mirrors the methods Rails' `Http::Parameters` calls on `self`.
 */
export interface ParametersHost {
  getHeader(key: string): unknown;
  setHeader(key: string, value: unknown): unknown;
  deleteHeader(key: string): void;
  queryParameters: Record<string, unknown>;
  requestParameters: Record<string, unknown>;
  contentLength: number;
  contentMimeType: MimeType | null;
  rawPost: string;
}

/**
 * Returns both GET and POST parameters in a single hash. Caches the merged
 * hash on the request env under `action_dispatch.request.parameters`.
 */
export function parameters(this: ParametersHost): Record<string, unknown> {
  const cached = this.getHeader("action_dispatch.request.parameters");
  if (cached) return cached as Record<string, unknown>;

  let params: Record<string, unknown>;
  try {
    params = { ...this.requestParameters, ...this.queryParameters };
  } catch {
    params = { ...this.queryParameters };
  }
  params = { ...params, ...pathParameters.call(this) };
  this.setHeader("action_dispatch.request.parameters", params);
  return params;
}

/**
 * Returns a hash with the parameters used to form the path of the request.
 *
 *     { action: "my_action", controller: "my_controller" }
 */
export function pathParameters(this: ParametersHost): Record<string, unknown> {
  const cached = this.getHeader(PARAMETERS_KEY);
  if (cached) return cached as Record<string, unknown>;
  const empty: Record<string, unknown> = {};
  this.setHeader(PARAMETERS_KEY, empty);
  return empty;
}

/**
 * Sets the path parameters, invalidating the merged-parameters cache. Mirrors
 * Rails' `path_parameters=` setter. Encoding-normalization (Rails calls
 * `Request::Utils.set_binary_encoding` + `check_param_encoding`) is left to
 * the caller since trails strings are already UTF-8.
 */
export function setPathParameters(this: ParametersHost, parameters: Record<string, unknown>): void {
  this.deleteHeader("action_dispatch.request.parameters");
  this.setHeader(PARAMETERS_KEY, parameters);
}

/**
 * Invokes the parser registered for the request's content MIME type. If no
 * body or no matching parser is found, calls `fallback()` (matching the Ruby
 * `yield` semantics).
 *
 * @internal
 */
export function parseFormattedParameters(
  this: ParametersHost,
  parsers: ParameterParsers,
  fallback: () => Record<string, unknown>,
): Record<string, unknown> {
  if (this.contentLength === 0 || this.contentMimeType === null) {
    return fallback();
  }
  const strategy = parsers[this.contentMimeType.symbol];
  if (!strategy) return fallback();

  try {
    return strategy(this.rawPost);
  } catch {
    throw new ParseError("Error occurred while parsing request parameters");
  }
}
