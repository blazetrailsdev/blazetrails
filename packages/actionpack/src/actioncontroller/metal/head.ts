/**
 * ActionController::Head
 *
 * Provides the `head` method for returning header-only responses.
 * @see https://api.rubyonrails.org/classes/ActionController/Head.html
 */

export interface Head {
  head(status: number | string, options?: Record<string, string>): void;
}
