/**
 * ActionDispatch::ParamBuilder
 *
 * Port of `actionpack/lib/action_dispatch/http/param_builder.rb`. Parses
 * query strings (and pre-parsed pair sequences) into nested parameter
 * hashes. Mirrors Rails' implementation, which is itself derived from
 * Rack::QueryParser.
 *
 * Rack 2's legacy "ignore leading brackets" behavior is reachable only
 * when callers explicitly opt in via {@link ParamBuilder.ignoreLeadingBrackets}.
 * trails targets Rack 3 (see `action-dispatch/constants.ts`), so the
 * `LEADING_BRACKETS_COMPAT` constant is hard-coded false.
 *
 * `Hash` in Rails maps to a null-prototype plain object here — both for
 * indifferent-key semantics (object keys are strings only in JS) and to
 * keep attacker-controlled `__proto__` keys from polluting the prototype.
 */

import { deprecator } from "../deprecator.js";
import { UploadedFile } from "./upload.js";
import { QueryParser, type QueryPair } from "./query-parser.js";
import { RequestUtils, type ParamHash, type ParamValue } from "../request/utils.js";
import { InvalidParameterError, ParameterTypeError, ParamsTooDeepError } from "./param-error.js";

export type EncodingTemplate = Record<string, string>;

/** @internal Rack 2 compat sentinel — always false under trails' Rack 3 target. */
const LEADING_BRACKETS_COMPAT = false;

export class ParamBuilder {
  readonly paramDepthLimit: number;

  constructor(paramDepthLimit: number) {
    this.paramDepthLimit = paramDepthLimit;
  }

  static makeDefault(paramDepthLimit: number): ParamBuilder {
    return new ParamBuilder(paramDepthLimit);
  }

  /** Mirrors `cattr_accessor :ignore_leading_brackets`. */
  static ignoreLeadingBrackets: boolean | null = null;

  /** Mirrors `cattr_accessor :default`. */
  static default: ParamBuilder = ParamBuilder.makeDefault(100);

  static fromQueryString(
    qs: string | null | undefined,
    options: { separator?: string | null; encodingTemplate?: EncodingTemplate | null } = {},
  ): ParamHash {
    return ParamBuilder.default.fromQueryString(qs, options);
  }

  static fromPairs(
    pairs: Iterable<QueryPair> | Iterable<[string, unknown]>,
    options: { encodingTemplate?: EncodingTemplate | null } = {},
  ): ParamHash {
    return ParamBuilder.default.fromPairs(pairs, options);
  }

  static fromHash(
    hash: ParamHash,
    options: { encodingTemplate?: EncodingTemplate | null } = {},
  ): ParamHash {
    return ParamBuilder.default.fromHash(hash, options);
  }

  fromQueryString(
    qs: string | null | undefined,
    options: { separator?: string | null; encodingTemplate?: EncodingTemplate | null } = {},
  ): ParamHash {
    return this.fromPairs(QueryParser.eachPair(qs, options.separator), {
      encodingTemplate: options.encodingTemplate,
    });
  }

  fromPairs(
    pairs: Iterable<QueryPair> | Iterable<[string, unknown]>,
    options: { encodingTemplate?: EncodingTemplate | null } = {},
  ): ParamHash {
    const params = makeParams();
    const encodingTemplate = options.encodingTemplate ?? null;

    try {
      for (const [k, rawV] of pairs) {
        let v = rawV as ParamValue;
        if (v !== null && typeof v === "object" && !Array.isArray(v)) {
          // Rails wraps Hash values (multipart payloads) as UploadedFile.
          v = new UploadedFile(v as never) as unknown as ParamValue;
        }
        storeNestedParam(params, k, v, 0, encodingTemplate, this.paramDepthLimit);
      }
    } catch (e) {
      if (e instanceof RangeError || (e instanceof Error && e.name === "ArgumentError")) {
        throw new InvalidParameterError(e.message);
      }
      throw e;
    }

    return params;
  }

  fromHash(
    hash: ParamHash,
    _options: { encodingTemplate?: EncodingTemplate | null } = {},
  ): ParamHash {
    // CustomParamEncoder/check_param_encoding are no-ops in JS (UTF-16
    // strings, no per-string encoding). Normalize through the same
    // pipeline as parseNestedQuery.
    return RequestUtils.normalizeEncodeParams(hash) as ParamHash;
  }
}

function makeParams(): ParamHash {
  return Object.create(null) as ParamHash;
}

function isParamsHash(obj: unknown): obj is ParamHash {
  return obj !== null && typeof obj === "object" && !Array.isArray(obj);
}

function paramsHashHasKey(hash: ParamHash, key: string): boolean {
  if (key.includes("[]")) return false;
  let h: ParamValue = hash;
  for (const part of key.split(/[[\]]+/)) {
    if (part === "") continue;
    if (!isParamsHash(h) || !Object.hasOwn(h, part)) return false;
    h = h[part];
  }
  return true;
}

function classNameOf(v: unknown): string {
  if (v === null) return "NilClass";
  if (Array.isArray(v)) return "Array";
  if (typeof v === "string") return "String";
  if (typeof v === "object") return "Hash";
  return typeof v;
}

/** @internal */
function storeNestedParam(
  params: ParamHash,
  name: string | null,
  v: ParamValue,
  depth: number,
  encodingTemplate: EncodingTemplate | null,
  depthLimit: number,
): ParamValue {
  if (depth >= depthLimit) throw new ParamsTooDeepError("param depth limit exceeded");

  let k: string;
  let after: string;

  if (name === null || name === undefined) {
    k = after = "";
  } else if (depth === 0) {
    const ignoreLeading = ParamBuilder.ignoreLeadingBrackets;
    if (ignoreLeading === true || (ignoreLeading === null && LEADING_BRACKETS_COMPAT)) {
      const m = name.match(/^([[\]]*)([^[\]]+)\]*/);
      if (m) {
        k = m[2];
        const matched = m[0];
        after = name.slice(matched.length);
        if (ignoreLeading !== true && (k !== matched || (after !== "" && !after.startsWith("[")))) {
          deprecator.warn(
            `Skipping over leading brackets in parameter name ${JSON.stringify(name)} is deprecated and will parse differently in Rails 8.1 or Rack 3.0.`,
          );
        }
      } else {
        k = name;
        after = "";
      }
    } else {
      const start = name.indexOf("[", 1);
      if (start !== -1) {
        k = name.slice(0, start);
        after = name.slice(start);
      } else {
        k = name;
        after = "";
      }
    }
  } else if (name.startsWith("[]")) {
    k = "[]";
    after = name.slice(2);
  } else if (name.startsWith("[")) {
    const end = name.indexOf("]", 1);
    if (end !== -1) {
      k = name.slice(1, end);
      after = name.slice(end + 1);
    } else {
      k = name;
      after = "";
    }
  } else {
    k = name;
    after = "";
  }

  if (k === "") return params;

  if (depth === 0 && typeof v === "string") {
    if (encodingTemplate && encodingTemplate[k]) {
      // force_encoding is a no-op in JS — strings are UTF-16. Encoding
      // validity is likewise structurally guaranteed; we don't surface
      // the InvalidParameterError "Invalid encoding" branch.
    }
  }

  if (after === "") {
    if (k === "[]" && depth !== 0) {
      return v !== null || !RequestUtils.performDeepMunge ? [v] : [];
    }
    params[k] = v;
  } else if (after === "[") {
    params[name as string] = v;
  } else if (after === "[]") {
    if (!Object.hasOwn(params, k)) params[k] = [];
    const arr = params[k];
    if (!Array.isArray(arr)) {
      throw new ParameterTypeError(`expected Array (got ${classNameOf(arr)}) for param \`${k}'`);
    }
    if (v !== null || !RequestUtils.performDeepMunge) arr.push(v);
  } else if (after.startsWith("[]")) {
    // Recognize x[][y] (hash inside array) parameters
    let childKey: string;
    if (after[2] === "[" && after.endsWith("]")) {
      const candidate = after.slice(3, after.length - 1);
      if (candidate !== "" && !candidate.includes("[") && !candidate.includes("]")) {
        childKey = candidate;
      } else {
        childKey = after.slice(2);
      }
    } else {
      childKey = after.slice(2);
    }
    if (!Object.hasOwn(params, k)) params[k] = [];
    const arr = params[k];
    if (!Array.isArray(arr)) {
      throw new ParameterTypeError(`expected Array (got ${classNameOf(arr)}) for param \`${k}'`);
    }
    const last = arr[arr.length - 1];
    if (isParamsHash(last) && !paramsHashHasKey(last, childKey)) {
      storeNestedParam(last, childKey, v, depth + 1, null, depthLimit);
    } else {
      arr.push(storeNestedParam(makeParams(), childKey, v, depth + 1, null, depthLimit));
    }
  } else {
    if (!Object.hasOwn(params, k)) params[k] = makeParams();
    const child = params[k];
    if (!isParamsHash(child)) {
      throw new ParameterTypeError(`expected Hash (got ${classNameOf(child)}) for param \`${k}'`);
    }
    params[k] = storeNestedParam(child, after, v, depth + 1, null, depthLimit) as ParamValue;
  }

  return params;
}
