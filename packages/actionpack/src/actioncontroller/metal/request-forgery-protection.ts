/**
 * ActionController::RequestForgeryProtection
 *
 * CSRF protection strategies for controllers.
 * @see https://api.rubyonrails.org/classes/ActionController/RequestForgeryProtection.html
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
  protectFromForgery(options?: {
    with?: "exception" | "reset_session" | "null_session";
    prepend?: boolean;
  }): void;
  verifyAuthenticityToken(): void;
  formAuthenticityToken(): string;
}

export interface ClassMethods {
  protectFromForgery(options?: {
    with?: "exception" | "reset_session" | "null_session";
    prepend?: boolean;
  }): void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ProtectionMethods {}

export class NullSession {
  call(_controller: unknown): void {
    // no-op
  }
}

export class NullSessionHash {
  constructor() {}
}

export class NullCookieJar {
  constructor() {}
}

export class ResetSession {
  call(_controller: unknown): void {
    // no-op
  }
}

export class Exception {
  call(_controller: unknown): void {
    // no-op
  }
}

export class SessionStore {
  constructor() {}
}

export class CookieStore {
  constructor() {}
}
