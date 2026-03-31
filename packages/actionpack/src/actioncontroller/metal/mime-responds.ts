/**
 * ActionController::MimeResponds
 *
 * Content negotiation via respond_to blocks. Re-exports the
 * ActionDispatch Collector which handles Accept parsing, format
 * symbol lookup via MimeType, variant support, and optional handlers.
 * @see https://api.rubyonrails.org/classes/ActionController/MimeResponds.html
 */

import {
  Collector as DispatchCollector,
  respondTo,
  type FormatHandler,
} from "../../actiondispatch/respond-to.js";
export { respondTo, type FormatHandler };

export class Collector extends DispatchCollector {}

export class VariantCollector {
  private _variants = new Map<string, () => void>();

  variant(name: string, handler: () => void): void {
    this._variants.set(name, handler);
  }

  get(name: string): (() => void) | undefined {
    return this._variants.get(name);
  }
}

export interface MimeResponds {
  respondTo(...mimes: string[]): void;
}
