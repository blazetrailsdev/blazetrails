/**
 * ActionController::Streaming
 *
 * Allows views to be streamed back to the client as they are rendered.
 * @see https://api.rubyonrails.org/classes/ActionController/Streaming.html
 */

export interface Streaming {
  render(options?: Record<string, unknown> & { stream?: boolean }): void;
}
