/**
 * ActionController::HttpAuthentication
 *
 * HTTP Basic, Digest, and Token authentication.
 * @see https://api.rubyonrails.org/classes/ActionController/HttpAuthentication.html
 */

export function decodeBasicCredentials(header: string): [string, string] {
  const match = header.match(/^Basic\s+(.+)$/i);
  if (!match) return ["", ""];
  const decoded = globalThis.Buffer.from(match[1], "base64").toString("utf-8");
  const idx = decoded.indexOf(":");
  if (idx < 0) return [decoded, ""];
  return [decoded.slice(0, idx), decoded.slice(idx + 1)];
}

export function encodeBasicCredentials(name: string, password: string): string {
  return `Basic ${globalThis.Buffer.from(`${name}:${password}`).toString("base64")}`;
}

export function basicAuthenticationRequest(
  realm: string = "Application",
  message: string = "HTTP Basic: Access denied.\n",
): { headers: Record<string, string>; status: number; body: string } {
  return {
    headers: { "www-authenticate": `Basic realm="${realm}"` },
    status: 401,
    body: message,
  };
}

export function encodeTokenCredentials(
  token: string,
  options: Record<string, string> = {},
): string {
  const pairs = Object.entries(options)
    .map(([k, v]) => `${k}="${v}"`)
    .join(", ");
  return pairs ? `Token token="${token}", ${pairs}` : `Token token="${token}"`;
}
