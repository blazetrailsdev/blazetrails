/**
 * ActionController::MimeResponds
 *
 * Content negotiation via respond_to blocks.
 * @see https://api.rubyonrails.org/classes/ActionController/MimeResponds.html
 */

const MIME_TO_SYMBOL: Record<string, string> = {
  "text/html": "html",
  "application/json": "json",
  "application/xml": "xml",
  "text/xml": "xml",
  "text/javascript": "js",
  "application/javascript": "js",
  "text/plain": "text",
  "text/csv": "csv",
  "*/*": "*/*",
};

export class Collector {
  private _responses = new Map<string, () => void>();
  private _order: string[] = [];

  [key: string]: unknown;

  any(handler: () => void): void {
    this._responses.set("*/*", handler);
    this._order.push("*/*");
  }

  all(handler: () => void): void {
    this.any(handler);
  }

  on(format: string, handler: () => void): void {
    this._responses.set(format, handler);
    this._order.push(format);
  }

  html(handler: () => void): void {
    this.on("html", handler);
  }

  json(handler: () => void): void {
    this.on("json", handler);
  }

  xml(handler: () => void): void {
    this.on("xml", handler);
  }

  js(handler: () => void): void {
    this.on("js", handler);
  }

  text(handler: () => void): void {
    this.on("text", handler);
  }

  csv(handler: () => void): void {
    this.on("csv", handler);
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
        const symbol = MIME_TO_SYMBOL[mime];
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
        if (key === "q" && val) q = parseFloat(val);
      }
      return { mime: mime.trim(), q };
    })
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
