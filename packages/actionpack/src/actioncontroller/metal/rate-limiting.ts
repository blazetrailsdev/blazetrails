/**
 * ActionController::RateLimiting
 *
 * Rate limiting for controller actions.
 * @see https://api.rubyonrails.org/classes/ActionController/RateLimiting.html
 */

export interface RateLimitingOptions {
  to: number;
  within: number;
  by?: (request: unknown) => string;
  with?: (request: unknown) => void;
  store?: unknown;
  name?: string;
  only?: string | string[];
  except?: string | string[];
}

export interface RateLimiting {
  rateLimit(options: RateLimitingOptions): void;
}
