/**
 * ActionDispatch::Assertions::RoutingAssertions — `this`-typed port of
 * Rails' `assertions/routing.rb`. Follow-ups: `withRouting`, URL-form
 * (`://`) path arguments, and `method_missing` named-route forwarding.
 */

import { RouteSet } from "../../routing/route-set.js";
import { RoutingError } from "../../../action-controller/metal/exceptions.js";
import { TestRequest } from "../test-request.js";

export interface RoutingAssertionsHost {
  routes?: RouteSet;
  controller?: unknown;
}

export interface PathWithMethod {
  path: string;
  method?: string | null;
}

type Options = Record<string, unknown>;

/** Asserts that `path` recognizes to `expectedOptions`. */
export function assertRecognizes(
  this: RoutingAssertionsHost,
  expectedOptions: Options,
  path: string | PathWithMethod,
  extras: Options = {},
  msg?: string,
): void {
  if (typeof path !== "string" && String(path.method ?? "").toLowerCase() === "all") {
    for (const method of ["get", "post", "put", "delete"] as const) {
      assertRecognizes.call(this, expectedOptions, { ...path, method }, extras, msg);
    }
    return;
  }
  const request = recognizedRequestFor.call(this, path, extras, msg);
  const expected = { ...expectedOptions };
  const actual = request.pathParameters as unknown as Options;
  if (!deepEqual(expected, actual)) {
    throw new Error(
      msg ??
        `The recognized options <${inspect(actual)}> did not match <${inspect(expected)}>, difference:`,
    );
  }
}

/** Inverse of `assertRecognizes`. */
export function assertGenerates(
  this: RoutingAssertionsHost,
  expectedPath: string,
  options: Options,
  defaults: Options = {},
  extras: Options = {},
  message?: string,
): void {
  const path = expectedPath.startsWith("/") ? expectedPath : `/${expectedPath}`;
  const routes = requireRoutes(this);
  const opts = { ...options };
  const [generatedPath, queryStringKeys] = routes.generateExtras(opts, defaults);
  const foundExtras: Options = {};
  for (const k of queryStringKeys) {
    if (Object.hasOwn(opts, k)) foundExtras[k] = opts[k];
  }
  if (!deepEqual(extras, foundExtras)) {
    throw new Error(message ?? `found extras <${inspect(foundExtras)}>, not <${inspect(extras)}>`);
  }
  if (generatedPath !== path) {
    throw new Error(message ?? `The generated path <${generatedPath}> did not match <${path}>`);
  }
}

/** Combined `assertRecognizes` + `assertGenerates`. */
export function assertRouting(
  this: RoutingAssertionsHost,
  path: string | PathWithMethod,
  options: Options,
  defaults: Options = {},
  extras: Options = {},
  message?: string,
): void {
  assertRecognizes.call(this, options, path, extras, message);
  const controller = options["controller"];
  const defaultController = defaults["controller"];
  if (
    typeof controller === "string" &&
    controller.includes("/") &&
    typeof defaultController === "string" &&
    defaultController.includes("/")
  ) {
    options = { ...options, controller: `/${controller}` };
  }
  const generateOptions: Options = {};
  for (const [k, v] of Object.entries(options)) {
    if (!Object.hasOwn(defaults, k)) generateOptions[k] = v;
  }
  const pathStr = typeof path === "string" ? path : path.path;
  assertGenerates.call(this, pathStr, generateOptions, defaults, extras, message);
}

/** @internal */
export function recognizedRequestFor(
  this: RoutingAssertionsHost,
  path: string | PathWithMethod,
  extras: Options = {},
  msg?: string,
): TestRequest {
  const method = typeof path === "string" ? "get" : String(path.method ?? "get");
  let pathStr = typeof path === "string" ? path : path.path;
  if (!pathStr.startsWith("/")) pathStr = `/${pathStr}`;

  const request = new TestRequest();
  request.env["PATH_INFO"] = pathStr;
  request.env["REQUEST_METHOD"] = method.toUpperCase();

  let params: Record<string, unknown>;
  try {
    params = requireRoutes(this).recognizePath(pathStr, { method, extras });
  } catch (e) {
    if (e instanceof RoutingError) throw new Error(msg ?? e.message, { cause: e });
    throw e;
  }
  request.pathParameters = params;
  return request;
}

function requireRoutes(host: RoutingAssertionsHost): RouteSet {
  if (!host.routes) {
    throw new Error("No routes available — set `this.routes` to a RouteSet first.");
  }
  return host.routes;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    return String(a) === String(b);
  }
  const ao = a as Options;
  const bo = b as Options;
  const ak = Object.keys(ao);
  if (ak.length !== Object.keys(bo).length) return false;
  for (const k of ak) {
    if (!Object.hasOwn(bo, k) || !deepEqual(ao[k], bo[k])) return false;
  }
  return true;
}

const inspect = (v: unknown): string => {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};
