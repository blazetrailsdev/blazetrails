/**
 * ActionController::ContentSecurityPolicy
 *
 * CSP header helpers for controllers.
 * @see https://api.rubyonrails.org/classes/ActionController/ContentSecurityPolicy.html
 */

export interface ContentSecurityPolicy {
  contentSecurityPolicy(enabled?: boolean, options?: Record<string, unknown>): void;
  contentSecurityPolicyNonce(): string;
}
