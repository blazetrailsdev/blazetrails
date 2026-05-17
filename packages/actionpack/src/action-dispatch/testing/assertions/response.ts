/**
 * ActionDispatch::Assertions::ResponseAssertions
 *
 * Functional port of the Rails ResponseAssertions module. Each
 * exported function accepts an explicit `host` (the Test instance)
 * whose `response` is checked. Mix in via `this`-typed assignment
 * (`Test.assertResponse = assertResponse`) when wiring into an
 * IntegrationTest class.
 */

import { AssertionResponse } from "../assertion-response.js";

export interface AssertionResponseHost {
  response: AssertionResponseLike;
  request?: { env?: Record<string, unknown> };
  controller?: unknown;
}

export interface AssertionResponseLike {
  status: number;
  body?: string;
  getHeader?: (key: string) => string | undefined;
}

const RESPONSE_PREDICATES: Record<string, (status: number) => boolean> = {
  success: (s) => s >= 200 && s <= 299,
  missing: (s) => s === 404,
  redirect: (s) => s >= 300 && s <= 399,
  error: (s) => s >= 500 && s <= 599,
};

export function assertResponse(
  this: AssertionResponseHost,
  type: number | string,
  message?: string,
): void {
  const status = this.response.status;
  const predicate = typeof type === "string" ? RESPONSE_PREDICATES[type] : undefined;

  if (predicate) {
    if (!predicate(status)) {
      throw new Error(message ?? generateResponseMessage(this, type, status));
    }
    return;
  }

  const expectedCode = parseInt(new AssertionResponse(type).code, 10);
  if (status !== expectedCode) {
    throw new Error(message ?? generateResponseMessage(this, type, status));
  }
}

export function assertRedirectedTo(
  this: AssertionResponseHost,
  urlOptions: string | RegExp,
  options: { status?: number | string } | string = {},
  message?: string,
): void {
  let opts: { status?: number | string } = {};
  if (typeof options === "string") {
    if (!message) message = options;
  } else {
    opts = options;
  }

  const status = opts.status ?? "redirect";
  assertResponse.call(this, status, message);

  const location = this.response.getHeader?.("location") ?? "";
  if (urlOptions instanceof RegExp) {
    if (urlOptions.test(location)) return;
  } else if (typeof urlOptions === "string") {
    if (normalizeRedirect(urlOptions) === normalizeRedirect(location)) return;
  }

  const expected =
    urlOptions instanceof RegExp ? urlOptions.source : normalizeRedirect(String(urlOptions));
  throw new Error(
    message ??
      `Expected response to be a redirect to <${expected}> but was a redirect to <${normalizeRedirect(location)}>`,
  );
}

function normalizeRedirect(fragment: string): string {
  // Faithful Rails port punts non-string fragments to
  // Redirecting._compute_redirect_to_location, which isn't ported yet.
  // For strings we return as-is (Rails parses through URI to canonicalize,
  // but normalizing relative vs. absolute belongs to Redirecting itself).
  return fragment;
}

function generateResponseMessage(
  host: AssertionResponseHost,
  expected: number | string,
  actual: number,
): string {
  const parts = [
    `Expected response to be a <${codeWithName(expected)}>, but was a <${codeWithName(actual)}>`,
  ];
  parts.push(locationIfRedirected(host));
  parts.push(exceptionIfPresent(host));
  parts.push(responseBodyIfShort(host));
  return parts.join("");
}

function codeWithName(codeOrName: number | string): string {
  return new AssertionResponse(codeOrName).codeAndName();
}

function locationIfRedirected(host: AssertionResponseHost): string {
  const status = host.response.status;
  if (status < 300 || status > 399) return "";
  const location = host.response.getHeader?.("location");
  if (!location) return "";
  return ` redirect to <${location}>`;
}

function exceptionIfPresent(host: AssertionResponseHost): string {
  const ex = host.request?.env?.["action_dispatch.exception"];
  if (!ex) return "";
  const message = ex instanceof Error ? ex.message : String(ex);
  return `\n\nException while processing request: ${message}\n`;
}

function responseBodyIfShort(host: AssertionResponseHost): string {
  const body = host.response.body ?? "";
  if (body.length > 500) return "";
  return `\nResponse body: ${body}`;
}
