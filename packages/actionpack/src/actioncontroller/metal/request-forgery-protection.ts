/**
 * ActionController::RequestForgeryProtection
 *
 * CSRF protection error classes defined in the ActionController namespace.
 * These will be raised by the CSRF verification flow once fully wired;
 * currently the ActionDispatch verifier throws its own version.
 * @see https://api.rubyonrails.org/classes/ActionController/InvalidAuthenticityToken.html
 */

import { ActionControllerError } from "./exceptions.js";

export class InvalidAuthenticityToken extends ActionControllerError {
  constructor(message?: string) {
    super(message ?? "Invalid authenticity token");
    this.name = "InvalidAuthenticityToken";
  }
}

export class InvalidCrossOriginRequest extends ActionControllerError {
  constructor(message?: string) {
    super(message ?? "Invalid cross-origin request");
    this.name = "InvalidCrossOriginRequest";
  }
}

export interface RequestForgeryProtection {
  verifyAuthenticityToken(): void;
  formAuthenticityToken(): string;
}

export interface ClassMethods {
  protectFromForgery(options?: {
    with?: "exception" | "reset_session" | "null_session";
    prepend?: boolean;
  }): void;
  skipForgeryProtection(options?: Record<string, unknown>): void;
}

export interface ProtectionMethods {
  handleUnverifiedRequest(): void;
}

export class NullSession implements ProtectionMethods {
  constructor(_controller: unknown) {}
  handleUnverifiedRequest(): void {}
}

export class NullSessionHash extends Map<string, unknown> {
  exists(): boolean {
    return false;
  }
  enabled(): boolean {
    return false;
  }
  destroy(): void {}
}

export class NullCookieJar extends Map<string, string> {
  constructor() {
    super();
  }
}

export class ResetSession implements ProtectionMethods {
  constructor(_controller: unknown) {}
  handleUnverifiedRequest(): void {}
}

export class Exception implements ProtectionMethods {
  constructor(_controller: unknown) {}
  handleUnverifiedRequest(): void {
    throw new InvalidAuthenticityToken();
  }
}

export class SessionStore {
  read(_session: unknown): string | null {
    return null;
  }
  write(_session: unknown, _token: string): void {}
}

export class CookieStore {
  read(_cookies: unknown): string | null {
    return null;
  }
  write(_cookies: unknown, _token: string): void {}
}
