/**
 * ActionController::UrlFor
 *
 * Includes url_for into the host class, adding HTTP-layer URL options.
 * @see https://api.rubyonrails.org/classes/ActionController/UrlFor.html
 */

export interface UrlFor {
  urlOptions: Record<string, unknown>;
  urlFor(options: string | Record<string, unknown>): string;
}
