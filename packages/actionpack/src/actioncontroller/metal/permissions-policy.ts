/**
 * ActionController::PermissionsPolicy
 *
 * Overrides parts of the globally configured Permissions-Policy header.
 * @see https://api.rubyonrails.org/classes/ActionController/PermissionsPolicy.html
 */

export function applyPermissionsPolicy(
  headers: Record<string, string>,
  policy: string | false,
): void {
  if (policy === false) {
    delete headers["permissions-policy"];
  } else {
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
