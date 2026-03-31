/**
 * ActionController::Caching
 *
 * Fragment caching for controllers.
 * @see https://api.rubyonrails.org/classes/ActionController/Caching.html
 */

export interface Caching {
  fragmentCacheKey(key: unknown): string;
}
