/**
 * ActionController::MimeResponds
 *
 * Content negotiation via respond_to blocks. Delegates MIME resolution
 * to ActionDispatch::MimeType.lookup for custom/vendor type support.
 * @see https://api.rubyonrails.org/classes/ActionController/MimeResponds.html
 */

import { MimeType } from "../../actiondispatch/mime-type.js";

export class Collector {
  private _responses = new Map<string, () => void>();
  private _order: string[] = [];

  [key: string]: unknown;

  private static _noop = (): void => {};

  any(handler?: () => void): this {
    this._responses.set("*/*", handler ?? Collector._noop);
    this._order.push("*/*");
    return this;
  }

  all(handler?: () => void): this {
    return this.any(handler);
  }

  on(format: string, handler?: () => void): this {
    this._responses.set(format, handler ?? Collector._noop);
    this._order.push(format);
    return this;
  }

  html(handler?: () => void): this {
    return this.on("html", handler);
  }

  json(handler?: () => void): this {
    return this.on("json", handler);
  }

  xml(handler?: () => void): this {
    return this.on("xml", handler);
  }

  js(handler?: () => void): this {
    return this.on("js", handler);
  }

  text(handler?: () => void): this {
    return this.on("text", handler);
  }

  csv(handler?: () => void): this {
    return this.on("csv", handler);
  }

  negotiate(options: { format?: string; accept?: string }): { handler: () => void } | null {
    if (options.format) {
      const handler = this._responses.get(options.format);
      if (handler) return { handler };
      const wildcard = this._responses.get("*/*");
      if (wildcard) return { handler: wildcard };
    }
    if (options.accept) {
      const types = parseAccept(options.accept);
      for (const { mime } of types) {
        if (mime === "*/*") {
          const first = this._order.find((r) => r !== "*/*") ?? this._order[0];
          if (first) return { handler: this._responses.get(first)! };
          continue;
        }
        const resolved = MimeType.lookup(mime);
        const symbol = resolved?.symbol;
        if (symbol) {
          const handler = this._responses.get(symbol);
          if (handler) return { handler };
        }
        const exact = this._responses.get(mime);
        if (exact) return { handler: exact };
      }
      const wildcard = this._responses.get("*/*");
      if (wildcard) return { handler: wildcard };
    }
    const first = this._order[0];
    if (first) {
      return { handler: this._responses.get(first)! };
    }
    return null;
  }
}

function parseAccept(header: string): Array<{ mime: string; q: number }> {
  return header
    .split(",")
    .map((part) => {
      const [mime, ...params] = part.trim().split(";");
      let q = 1;
      for (const param of params) {
        const [key, val] = param.trim().split("=");
        if (key === "q" && val) {
          const parsed = parseFloat(val);
          q = Number.isNaN(parsed) ? 0 : parsed;
        }
      }
      return { mime: mime.trim(), q };
    })
    .filter(({ mime, q }) => mime.length > 0 && q > 0)
    .sort((a, b) => b.q - a.q);
}

export class VariantCollector {
  private _variants = new Map<string, () => void>();

  variant(name: string, handler: () => void): void {
    this._variants.set(name, handler);
  }

  get(name: string): (() => void) | undefined {
    return this._variants.get(name);
  }
}
