/**
 * ActionController::PermissionsPolicy
 *
 * Overrides parts of the globally configured Permissions-Policy header.
 * @see https://api.rubyonrails.org/classes/ActionController/PermissionsPolicy.html
 */

function deleteHeaderCaseInsensitive(headers: Record<string, string>, name: string): void {
  const lower = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lower) delete headers[key];
  }
}

export function applyPermissionsPolicy(
  headers: Record<string, string>,
  policy: string | false,
): void {
  deleteHeaderCaseInsensitive(headers, "permissions-policy");
  if (policy !== false) {
    headers["permissions-policy"] = policy;
  }
}

export function buildPermissionsPolicy(directives: Record<string, string | string[]>): string {
  const parts: string[] = [];
  for (const [feature, values] of Object.entries(directives)) {
    const valueList = Array.isArray(values) ? values.join(" ") : values;
    parts.push(`${feature}=(${valueList})`);
  }
  return parts.join(", ");
}
