/**
 * ActionController::Renderer
 *
 * Allows rendering templates outside of controller actions.
 * @see https://api.rubyonrails.org/classes/ActionController/Renderer.html
 */

import { Metal } from "./metal.js";

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
    const status =
      merged.status !== undefined && merged.status !== null
        ? Metal.resolveStatus(merged.status as number | string)
        : 200;
    const explicitContentType =
      (merged.contentType as string | undefined) ?? (merged.content_type as string | undefined);

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
