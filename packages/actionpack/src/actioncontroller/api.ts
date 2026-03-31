/**
 * ActionController::API
 *
 * JSON-only variant of Base. No template rendering, no cookies/flash.
 * @see https://api.rubyonrails.org/classes/ActionController/API.html
 */

import { Metal } from "./metal.js";
import { DoubleRenderError, type RenderOptions } from "./base.js";

export class API extends Metal {
  static withoutModules(..._modules: unknown[]): typeof API {
    return this;
  }

  render(options: RenderOptions = {}): void {
    if (this.performed) {
      throw new DoubleRenderError();
    }

    if (options.status) {
      this.status = options.status;
    }

    if (options.json !== undefined) {
      this.contentType = options.contentType ?? "application/json; charset=utf-8";
      this.body = typeof options.json === "string" ? options.json : JSON.stringify(options.json);
    } else if (options.plain !== undefined) {
      this.contentType = options.contentType ?? "text/plain; charset=utf-8";
      this.body = options.plain;
    } else if (options.body !== undefined) {
      this.body = options.body;
    }

    this.markPerformed();
  }

  redirectTo(url: string, options: { status?: number | string } = {}): void {
    if (this.performed) {
      throw new DoubleRenderError();
    }

    const status = options.status ? Metal.resolveStatus(options.status) : 302;
    this.status = status;
    this.setHeader("location", url);
    this.body = "";
    this.markPerformed();
  }
}
