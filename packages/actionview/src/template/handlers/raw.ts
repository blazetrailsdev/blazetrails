import type { RenderContext, TemplateHandler } from "../handlers.js";

/**
 * ActionView::Template::Handlers::Raw
 *
 * Passthrough handler used for templates whose source is already the
 * desired output (`.txt`, `.html`, etc.). Rails returns
 * `"#{source.inspect}.html_safe;"` — a literal expression that, when
 * compiled, yields the source string marked html-safe. The TS port skips
 * the codegen indirection and just returns the source verbatim; downstream
 * rendering treats the result as html-safe.
 */
export class Raw implements TemplateHandler {
  readonly extensions = ["raw", "txt", "html", "ruby"];

  render(source: string, _locals: Record<string, unknown>, _context: RenderContext): string {
    return source;
  }
}
