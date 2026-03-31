/**
 * ActionController::ContentSecurityPolicy
 *
 * Overrides or disables the globally configured Content-Security-Policy
 * header on a per-controller or per-action basis.
 * @see https://api.rubyonrails.org/classes/ActionController/ContentSecurityPolicy.html
 */

import { randomBytes } from "crypto";

export function contentSecurityPolicyNonce(): string {
  return randomBytes(16).toString("base64");
}

export function hasContentSecurityPolicy(response: {
  getHeader(name: string): string | undefined;
}): boolean {
  return response.getHeader("content-security-policy") !== undefined;
}

function deleteHeaderCaseInsensitive(headers: Record<string, string>, name: string): void {
  const lower = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lower) delete headers[key];
  }
}

export function applyContentSecurityPolicy(
  headers: Record<string, string>,
  policy: string | false,
): void {
  deleteHeaderCaseInsensitive(headers, "content-security-policy");
  if (policy !== false) {
    headers["content-security-policy"] = policy;
  }
}
