/**
 * ActionController::RequestForgeryProtection
 *
 * CSRF protection error classes. These are raised when an invalid
 * authenticity token or cross-origin request is detected.
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
