/**
 * ActionController::RequestForgeryProtection
 *
 * CSRF protection error classes and strategy implementations.
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

export interface ProtectionMethods {
  handleUnverifiedRequest(): void;
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
  get signed(): NullCookieJar {
    return this;
  }
  get encrypted(): NullCookieJar {
    return this;
  }
}

type Controller = Record<string, unknown>;

export class NullSession implements ProtectionMethods {
  private _controller: Controller;
  constructor(controller: Controller) {
    this._controller = controller;
  }
  handleUnverifiedRequest(): void {
    this._controller.session = new NullSessionHash();
    this._controller.cookies = new NullCookieJar();
    if (this._controller.flash !== undefined) {
      this._controller.flash = new NullSessionHash();
    }
  }
}

export class ResetSession implements ProtectionMethods {
  private _controller: Controller;
  constructor(controller: Controller) {
    this._controller = controller;
  }
  handleUnverifiedRequest(): void {
    this._controller.session = {};
  }
}

export class Exception implements ProtectionMethods {
  constructor(_controller: Controller) {}
  handleUnverifiedRequest(): void {
    throw new InvalidAuthenticityToken();
  }
}

const TOKEN_KEY = "_csrf_token";

export class SessionStore {
  read(session: Record<string, unknown>): string | null {
    const token = session[TOKEN_KEY];
    return typeof token === "string" ? token : null;
  }
  write(session: Record<string, unknown>, token: string): void {
    session[TOKEN_KEY] = token;
  }
}

export class CookieStore {
  private _cookieName: string;
  constructor(cookieName = "csrf_token") {
    this._cookieName = cookieName;
  }
  read(cookies: Record<string, string>): string | null {
    return cookies[this._cookieName] ?? null;
  }
  write(cookies: Record<string, string>, token: string): void {
    cookies[this._cookieName] = token;
  }
}
