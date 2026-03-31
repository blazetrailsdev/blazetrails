/**
 * ActionController::Head
 *
 * Returns a response that has no content (merely headers).
 * @see https://api.rubyonrails.org/classes/ActionController/Head.html
 */

const STATUS_SYMBOLS: Record<string, number> = {
  ok: 200,
  created: 201,
  accepted: 202,
  no_content: 204,
  moved_permanently: 301,
  found: 302,
  see_other: 303,
  not_modified: 304,
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  method_not_allowed: 405,
  not_acceptable: 406,
  conflict: 409,
  gone: 410,
  unprocessable_entity: 422,
  too_many_requests: 429,
  internal_server_error: 500,
  not_implemented: 501,
  bad_gateway: 502,
  service_unavailable: 503,
};

function resolveStatus(status: number | string): number {
  if (typeof status === "number") return status;
  return STATUS_SYMBOLS[status] ?? 500;
}

export function includeContent(status: number): boolean {
  if (status >= 100 && status <= 199) return false;
  if (status === 204 || status === 205 || status === 304) return false;
  return true;
}

export function headResponse(
  status: number | string,
  options?: Record<string, string>,
): { status: number; headers: Record<string, string>; body: string } {
  const headers: Record<string, string> = {};
  if (options) {
    for (const [key, value] of Object.entries(options)) {
      if (key === "location") {
        headers["location"] = String(value);
        continue;
      }
      if (key === "content_type") {
        headers["content-type"] = String(value);
        continue;
      }
      const headerName = key.replace(/_/g, "-").toLowerCase();
      headers[headerName] = String(value);
    }
  }
  return { status: resolveStatus(status), headers, body: "" };
}
