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

  newRenderer(env: Record<string, unknown> = {}): Renderer {
    return new Renderer(this._controller, { ...this._defaults, ...env });
  }

  render(...args: unknown[]): unknown {
    return null;
  }

  get defaults(): Record<string, unknown> {
    return { ...this._defaults };
  }
}
