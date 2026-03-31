/**
 * ActionController::MimeResponds
 *
 * Content negotiation via respond_to blocks.
 * @see https://api.rubyonrails.org/classes/ActionController/MimeResponds.html
 */

export interface MimeResponds {
  respondTo(block: (collector: Collector) => void): void;
}

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

  negotiate(options: { format?: string; accept?: string }): { handler: () => void } | null {
    if (options.format) {
      const handler = this._responses.get(options.format);
      if (handler) return { handler };
    }
    const first = this._order[0];
    if (first) {
      return { handler: this._responses.get(first)! };
    }
    return null;
  }
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
