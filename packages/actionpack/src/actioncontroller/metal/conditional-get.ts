/**
 * ActionController::ConditionalGet
 *
 * Provides fresh_when, stale?, expires_in, http_cache_forever.
 * @see https://api.rubyonrails.org/classes/ActionController/ConditionalGet.html
 */

export interface ConditionalGet {
  freshWhen(options: { etag?: string; lastModified?: Date; public?: boolean }): void;
  stale(options: { etag?: string; lastModified?: Date; public?: boolean }): boolean;
  expiresIn(seconds: number, options?: { public?: boolean; mustRevalidate?: boolean }): void;
  expiresNow(): void;
  httpCacheForever(options?: { public?: boolean }): void;
}
