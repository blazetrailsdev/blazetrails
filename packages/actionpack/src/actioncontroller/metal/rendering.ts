/**
 * ActionController::Rendering
 *
 * Render dispatch module mixed into controllers. Checks for double render
 * and processes render format priorities.
 * @see https://api.rubyonrails.org/classes/ActionController/Rendering.html
 */

export const RENDER_FORMATS_IN_PRIORITY = ["body", "plain", "html"] as const;

export function renderInPriorities(options: Record<string, unknown>): unknown | null {
  for (const format of RENDER_FORMATS_IN_PRIORITY) {
    if (format in options) return options[format];
  }
  return null;
}

export function normalizeRenderOptions(options: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...options };

  if (normalized.status && typeof normalized.status === "string") {
    const STATUS_CODES: Record<string, number> = {
      ok: 200,
      created: 201,
      no_content: 204,
      bad_request: 400,
      unauthorized: 401,
      forbidden: 403,
      not_found: 404,
      unprocessable_entity: 422,
      internal_server_error: 500,
    };
    normalized.status = STATUS_CODES[normalized.status as string] ?? normalized.status;
  }

  return normalized;
}

export function processRenderOptions(options: Record<string, unknown>): {
  status?: number;
  contentType?: string;
  location?: string;
} {
  const result: { status?: number; contentType?: string; location?: string } = {};
  if (options.status) result.status = options.status as number;
  if (options.contentType || options.content_type)
    result.contentType = (options.contentType ?? options.content_type) as string;
  if (options.location) result.location = options.location as string;
  return result;
}
