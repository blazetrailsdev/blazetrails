/**
 * ActionController::Redirecting
 *
 * UnsafeRedirectError raised when a redirect URL is not considered safe.
 * The redirect_to/redirect_back methods live in Base.
 * @see https://api.rubyonrails.org/classes/ActionController/Redirecting.html
 */

export class UnsafeRedirectError extends Error {
  constructor(message?: string) {
    super(message ?? "Unsafe redirect");
    this.name = "UnsafeRedirectError";
  }
}

export interface RedirectingHost {
  request: { referer?: string | null; host?: string };
  redirectTo(url: string, options?: Record<string, unknown>): void;
}

export function redirectBackOrTo(
  this: RedirectingHost,
  fallbackLocation: string,
  options: { allowOtherHost?: boolean } & Record<string, unknown> = {},
): void {
  const { allowOtherHost = true, ...redirectOptions } = options;
  const referer = this.request.referer;
  if (referer && (allowOtherHost || urlHostAllowed(referer, this.request.host ?? ""))) {
    this.redirectTo(referer, { allowOtherHost, ...redirectOptions });
  } else {
    this.redirectTo(fallbackLocation, redirectOptions);
  }
}

export function urlFrom(this: RedirectingHost, location: string | null | undefined): string | null {
  if (!location || location.trim() === "") return null;
  return urlHostAllowed(location, this.request.host ?? "") ? location : null;
}

function urlHostAllowed(location: string, requestHost: string): boolean {
  const trimmed = location.trim();
  if (trimmed.startsWith("//") || trimmed.startsWith("\\")) return false;

  try {
    const url = new URL(trimmed);
    return url.hostname === requestHost;
  } catch {
    // Relative paths like "/foo" or "bar" are internal
    return !trimmed.includes("://");
  }
}
