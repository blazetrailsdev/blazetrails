/**
 * ActionController::DefaultHeaders
 *
 * Allows configuring default headers that will be automatically merged
 * into each response.
 * @see https://api.rubyonrails.org/classes/ActionController/DefaultHeaders.html
 */

export interface DefaultHeaders {
  defaultHeaders: Record<string, string>;
}
