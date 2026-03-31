/**
 * ActionController::DefaultHeaders
 *
 * Allows configuring default headers that will be automatically merged
 * into each response.
 * @see https://api.rubyonrails.org/classes/ActionController/DefaultHeaders.html
 */

const _defaultHeaders: Record<string, string> = {};

export function setDefaultHeaders(headers: Record<string, string>): void {
  Object.assign(_defaultHeaders, headers);
}

export function getDefaultHeaders(): Record<string, string> {
  return { ..._defaultHeaders };
}

export function clearDefaultHeaders(): void {
  for (const key of Object.keys(_defaultHeaders)) {
    delete _defaultHeaders[key];
  }
}

export function applyDefaultHeaders(responseHeaders: Record<string, string>): void {
  for (const [key, value] of Object.entries(_defaultHeaders)) {
    if (!(key in responseHeaders)) {
      responseHeaders[key] = value;
    }
  }
}
