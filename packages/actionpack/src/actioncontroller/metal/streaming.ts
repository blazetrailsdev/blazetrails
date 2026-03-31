/**
 * ActionController::Streaming
 *
 * Allows views to be streamed back to the client as they are rendered.
 * When streaming, the layout is rendered first and template parts follow.
 * @see https://api.rubyonrails.org/classes/ActionController/Streaming.html
 */

export function isStreamingRequest(options: Record<string, unknown>): boolean {
  return options.stream === true;
}

export function prepareStreamingHeaders(headers: Record<string, string>): void {
  if (!headers["cache-control"]) {
    headers["cache-control"] = "no-cache";
  }
}
