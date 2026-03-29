/**
 * Fixture render context — provides the evaluation context for
 * fixture templates (ERB in Rails, template literals in TS).
 *
 * Mirrors: ActiveRecord::FixtureSet::RenderContext
 */

export class RenderContext {
  private _helpers = new Map<string, (...args: unknown[]) => unknown>();

  registerHelper(name: string, fn: (...args: unknown[]) => unknown): void {
    this._helpers.set(name, fn);
  }

  getHelper(name: string): ((...args: unknown[]) => unknown) | undefined {
    return this._helpers.get(name);
  }

  render(template: string, locals: Record<string, unknown> = {}): string {
    return template.replace(/\$\{(\w+)\}/g, (_match, key) => {
      if (key in locals) return String(locals[key]);
      const helper = this._helpers.get(key);
      if (helper) return String(helper());
      return "";
    });
  }
}
