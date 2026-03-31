/**
 * ActionController::Head
 *
 * Returns a response that has no content (merely headers).
 * @see https://api.rubyonrails.org/classes/ActionController/Head.html
 */

export function includeContent(status: number): boolean {
  if (status >= 100 && status <= 199) return false;
  if (status === 204 || status === 205 || status === 304) return false;
  return true;
}

export function headResponse(
  status: number | string,
  options?: Record<string, string>,
): { status: number | string; headers: Record<string, string>; body: string } {
  const headers: Record<string, string> = {};
  if (options) {
    for (const [key, value] of Object.entries(options)) {
      if (key === "location" || key === "content_type") continue;
      const headerName = key.replace(/_/g, "-").toLowerCase();
      headers[headerName] = String(value);
    }
  }
  return { status, headers, body: "" };
}
