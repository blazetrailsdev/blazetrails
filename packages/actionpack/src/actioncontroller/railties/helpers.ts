/**
 * ActionController::Railties::Helpers
 *
 * Provides helper inclusion via Railtie. When a controller is inherited,
 * automatically includes matching helper modules.
 * @see https://api.rubyonrails.org/classes/ActionController/Railties/Helpers.html
 */

export function resolveHelperPath(controllerName: string): string {
  const base = controllerName.replace(/Controller$/, "");
  const underscored = base
    .replace(/::/g, "/")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z\d])([A-Z])/g, "$1_$2")
    .toLowerCase();
  return underscored + "_helper";
}

export function inheritedWithHelpers(
  klass: { name: string },
  helperLoader?: (path: string) => unknown,
): void {
  const path = resolveHelperPath(klass.name);
  helperLoader?.(path);
}
