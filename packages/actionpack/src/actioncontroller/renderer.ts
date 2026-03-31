/**
 * ActionController::Renderer
 *
 * Allows rendering templates outside of controller actions.
 * @see https://api.rubyonrails.org/classes/ActionController/Renderer.html
 */

const STATUS_SYMBOLS: Record<string, number> = {
  ok: 200,
  created: 201,
  accepted: 202,
  no_content: 204,
  moved_permanently: 301,
  found: 302,
  see_other: 303,
  not_modified: 304,
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  unprocessable_entity: 422,
  too_many_requests: 429,
  internal_server_error: 500,
  not_implemented: 501,
  bad_gateway: 502,
  service_unavailable: 503,
};

function resolveStatus(status: unknown): number | undefined {
  if (status === undefined || status === null) return undefined;
  if (typeof status === "number") return status;
  if (typeof status === "string")
    return (STATUS_SYMBOLS[status] ?? parseInt(status, 10)) || undefined;
  return undefined;
}

export class Renderer {
  private _controller: unknown;
  private _defaults: Record<string, unknown>;

  constructor(controller: unknown, defaults: Record<string, unknown> = {}) {
    this._controller = controller;
    this._defaults = defaults;
  }

  static for(controller: unknown, defaults: Record<string, unknown> = {}): Renderer {
    return new Renderer(controller, defaults);
  }

  /** Derive a new Renderer with updated env (Rails: Renderer#new). */
  new(env: Record<string, unknown> = {}): Renderer {
    return new Renderer(this._controller, { ...this._defaults, ...env });
  }

  render(options: Record<string, unknown> = {}): Record<string, unknown> {
    const merged = { ...this._defaults, ...options };
    const status = resolveStatus(merged.status) ?? 200;
    const explicitContentType = merged.contentType as string | undefined;

    if (merged.json !== undefined) {
      const body = typeof merged.json === "string" ? merged.json : JSON.stringify(merged.json);
      return {
        status,
        contentType: explicitContentType ?? "application/json; charset=utf-8",
        body,
      };
    }
    if (merged.plain !== undefined) {
      return {
        status,
        contentType: explicitContentType ?? "text/plain; charset=utf-8",
        body: String(merged.plain),
      };
    }
    if (merged.html !== undefined) {
      return {
        status,
        contentType: explicitContentType ?? "text/html; charset=utf-8",
        body: String(merged.html),
      };
    }

    return { status, contentType: explicitContentType ?? "text/html; charset=utf-8", body: "" };
  }

  get defaults(): Record<string, unknown> {
    return { ...this._defaults };
  }

  get controller(): unknown {
    return this._controller;
  }
}
