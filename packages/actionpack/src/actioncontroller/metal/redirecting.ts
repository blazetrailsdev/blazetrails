/**
 * ActionController::Redirecting
 *
 * Provides redirect_to and redirect_back for controllers.
 * @see https://api.rubyonrails.org/classes/ActionController/Redirecting.html
 */

export class UnsafeRedirectError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "UnsafeRedirectError";
  }
}

export interface Redirecting {
  redirectTo(url: string, options?: { status?: number | string; allow_other_host?: boolean }): void;
  redirectBack(options: {
    fallbackLocation: string;
    status?: number | string;
    allow_other_host?: boolean;
  }): void;
}
