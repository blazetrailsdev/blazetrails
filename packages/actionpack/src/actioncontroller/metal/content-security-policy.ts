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

export function applyContentSecurityPolicy(
  headers: Record<string, string>,
  policy: string | false,
): void {
  if (policy === false) {
    delete headers["content-security-policy"];
  } else {
    headers["content-security-policy"] = policy;
  }
}
