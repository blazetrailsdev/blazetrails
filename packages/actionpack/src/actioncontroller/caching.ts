/**
 * ActionController::Caching
 *
 * Fragment caching support for controllers.
 * @see https://api.rubyonrails.org/classes/ActionController/Caching.html
 */

function serializeValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

export function fragmentCacheKey(
  key: string | string[] | Record<string, unknown>,
  controller?: string,
): string {
  if (typeof key === "string") {
    return controller ? `${controller}/${key}` : key;
  }
  if (Array.isArray(key)) {
    const parts = controller ? [controller, ...key] : key;
    return parts.join("/");
  }
  const sorted = Object.keys(key)
    .sort()
    .map((k) => `${k}=${serializeValue(key[k])}`)
    .join("/");
  return controller ? `${controller}/${sorted}` : sorted;
}
