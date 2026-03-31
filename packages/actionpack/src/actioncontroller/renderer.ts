/**
 * ActionController::Renderer
 *
 * Allows rendering templates outside of controller actions.
 * @see https://api.rubyonrails.org/classes/ActionController/Renderer.html
 */

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

    if (merged.json !== undefined) {
      const body = typeof merged.json === "string" ? merged.json : JSON.stringify(merged.json);
      return { status: 200, contentType: "application/json; charset=utf-8", body };
    }
    if (merged.plain !== undefined) {
      return { status: 200, contentType: "text/plain; charset=utf-8", body: String(merged.plain) };
    }
    if (merged.html !== undefined) {
      return { status: 200, contentType: "text/html; charset=utf-8", body: String(merged.html) };
    }

    return { status: 200, contentType: "text/html; charset=utf-8", body: "", ...merged };
  }

  get defaults(): Record<string, unknown> {
    return { ...this._defaults };
  }

  get controller(): unknown {
    return this._controller;
  }
}
