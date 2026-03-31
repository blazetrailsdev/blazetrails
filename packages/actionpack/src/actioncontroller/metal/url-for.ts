/**
 * ActionController::UrlFor
 *
 * Includes url_for into the host class, adding HTTP-layer URL options
 * like host, port, and protocol from the current request.
 * @see https://api.rubyonrails.org/classes/ActionController/UrlFor.html
 */

export function urlOptionsFromRequest(request: {
  host?: string;
  port?: number | string;
  protocol?: string;
  pathParameters?: Record<string, string>;
}): Record<string, unknown> {
  return {
    host: request.host ?? "localhost",
    port: request.port,
    protocol: request.protocol ?? "http",
    _recall: request.pathParameters ?? {},
  };
}

export function urlFor(
  options: string | Record<string, unknown>,
  urlOptions: Record<string, unknown> = {},
): string {
  if (typeof options === "string") return options;

  const protocol = (options.protocol ?? urlOptions.protocol ?? "http") as string;
  const host = (options.host ?? urlOptions.host ?? "localhost") as string;
  const port = options.port ?? urlOptions.port;
  const path = (options.path ?? "/") as string;

  let url = `${protocol}://${host}`;
  if (port && port !== 80 && port !== 443) {
    url += `:${port}`;
  }
  url += path;
  return url;
}
