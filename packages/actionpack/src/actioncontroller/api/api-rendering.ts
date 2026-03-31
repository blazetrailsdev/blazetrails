/**
 * ActionController::ApiRendering
 *
 * Rendering module included in API controllers.
 * @see https://api.rubyonrails.org/classes/ActionController/ApiRendering.html
 */

export interface ApiRendering {
  render(options?: Record<string, unknown>): void;
}
