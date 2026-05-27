import type { LookupContext } from "../lookup-context.js";
import { MissingTemplate } from "../lookup-context.js";
import { AbstractRenderer, RenderedTemplate } from "./abstract-renderer.js";
import type { RenderableTemplate, ViewContext, RenderOptions } from "./abstract-renderer.js";

/**
 * ActionView::TemplateRenderer
 *
 * Resolves and renders a single template (non-partial). Handles the
 * `template:`, `inline:`, `body:`, `plain:`, `html:`, and `renderable:`
 * render paths. Wraps the rendered body in a layout when `layout:` is set.
 * @internal
 */
export class TemplateRenderer extends AbstractRenderer {
  /** Details extracted from options on each render call. @internal */
  private details: Record<string, readonly (string | symbol)[]> = {};

  constructor(lookupContext: LookupContext) {
    super(lookupContext);
  }

  async render(context: ViewContext, options: RenderOptions): Promise<RenderedTemplate> {
    this.details = this.extractDetails(options as Record<string, unknown>);
    const template = this.determineTemplate(options);
    this.prependFormats(template.format ? [template.format] : null);
    return this.renderTemplate(context, template, options.layout, options.locals ?? {});
  }

  /** @internal */
  private determineTemplate(options: RenderOptions): RenderableTemplate {
    const keys = options.locals ? Object.keys(options.locals) : [];

    if (Object.prototype.hasOwnProperty.call(options, "body")) {
      return new BodyTemplate(String(options.body ?? ""));
    }
    if (Object.prototype.hasOwnProperty.call(options, "plain")) {
      return new PlainTemplate(String(options.plain ?? ""));
    }
    if (Object.prototype.hasOwnProperty.call(options, "html")) {
      return new HtmlTemplate(String(options.html ?? ""), (this.formats[0] as string) ?? "html");
    }
    if (Object.prototype.hasOwnProperty.call(options, "inline")) {
      return new InlineTemplate(String(options.inline ?? ""), options.type);
    }
    if (Object.prototype.hasOwnProperty.call(options, "renderable") && options.renderable) {
      return new RenderableWrapper(options.renderable);
    }
    if (Object.prototype.hasOwnProperty.call(options, "template") && options.template != null) {
      const tmpl = options.template;
      if (typeof tmpl === "object" && typeof (tmpl as RenderableTemplate).render === "function") {
        return tmpl as RenderableTemplate;
      }
      return this.resolveTemplate(tmpl as string, options.prefixes ?? [], keys);
    }
    throw new Error(
      "You invoked render but did not give any of :body, :file, :html, :inline, :partial, :plain, :renderable, or :template option.",
    );
  }

  /** @internal */
  private resolveTemplate(
    name: string,
    prefixes: readonly string[],
    keys: readonly string[],
  ): RenderableTemplate {
    const found = this.lookupContext.findAll(
      name,
      prefixes as string[],
      false,
      keys,
      this.details,
    ) as RenderableTemplate[];
    if (found.length > 0) return found[0]!;

    // Fall back to the simpler 3-arg resolver when Rails-shape finds nothing.
    const lastSlash = name.lastIndexOf("/");
    const baseName = lastSlash >= 0 ? name.slice(lastSlash + 1) : name;
    const prefix = lastSlash >= 0 ? name.slice(0, lastSlash) : (prefixes[0] ?? "");
    const format = (this.formats[0] as string | undefined) ?? "html";
    const template = this.lookupContext.findTemplate(baseName, prefix, format);
    if (template) return template as unknown as RenderableTemplate;

    throw new MissingTemplate(prefix, baseName, format, [], []);
  }

  /** @internal */
  private async renderTemplate(
    context: ViewContext,
    template: RenderableTemplate,
    layoutOption: RenderOptions["layout"],
    locals: Record<string, unknown>,
  ): Promise<RenderedTemplate> {
    return this.renderWithLayout(context, template, layoutOption, locals);
  }

  /** @internal */
  private async renderWithLayout(
    context: ViewContext,
    template: RenderableTemplate,
    layoutOption: RenderOptions["layout"],
    locals: Record<string, unknown>,
  ): Promise<RenderedTemplate> {
    const layout =
      layoutOption != null && layoutOption !== false
        ? this.findLayout(layoutOption, Object.keys(locals))
        : null;

    if (layout) {
      const body = await template.render(locals, context);
      if (context.viewFlow) {
        context.viewFlow.set("layout", body);
      }
      const layoutBody = await layout.render(locals, context);
      return this.buildRenderedTemplate(layoutBody, template);
    }

    const body = await template.render(locals, context);
    return this.buildRenderedTemplate(body, template);
  }

  /** @internal */
  private findLayout(
    layout:
      | string
      | ((ctx: LookupContext, formats: readonly string[], keys: readonly string[]) => string),
    keys: string[],
  ): RenderableTemplate | null {
    if (typeof layout === "function") {
      const resolved = layout(this.lookupContext, this.formats as readonly string[], keys);
      return resolved ? this.findLayout(resolved, keys) : null;
    }
    if (layout.startsWith("/")) {
      throw new Error("Rendering layouts from an absolute path is not supported.");
    }
    const format = (this.formats[0] as string | undefined) ?? "html";
    const found = this.lookupContext.findLayout(layout, format);
    return found as unknown as RenderableTemplate | null;
  }
}

// --- Inline template wrappers (mirrors Rails Template::Text, Template::HTML, etc.) ---

class BodyTemplate implements RenderableTemplate {
  readonly identifier = "body template";
  readonly format = null;

  constructor(private readonly content: string) {}

  async render(_locals: Record<string, unknown>, _context?: ViewContext): Promise<string> {
    return this.content;
  }
}

class PlainTemplate implements RenderableTemplate {
  readonly identifier = "plain template";
  readonly format = "text";

  constructor(private readonly content: string) {}

  async render(_locals: Record<string, unknown>, _context?: ViewContext): Promise<string> {
    return this.content;
  }
}

class HtmlTemplate implements RenderableTemplate {
  readonly identifier = "html template";

  constructor(
    private readonly content: string,
    readonly format: string,
  ) {}

  async render(_locals: Record<string, unknown>, _context?: ViewContext): Promise<string> {
    return this.content;
  }
}

class InlineTemplate implements RenderableTemplate {
  readonly identifier = "inline template";
  readonly format: string | null;

  constructor(
    private readonly source: string,
    type: string | undefined,
  ) {
    this.format = type ?? null;
  }

  async render(_locals: Record<string, unknown>, _context?: ViewContext): Promise<string> {
    return this.source;
  }
}

class RenderableWrapper implements RenderableTemplate {
  readonly identifier = "renderable";
  readonly format = null;

  constructor(private readonly inner: { renderIn(context: ViewContext): string }) {}

  async render(_locals: Record<string, unknown>, context?: ViewContext): Promise<string> {
    return this.inner.renderIn(context ?? {});
  }
}
