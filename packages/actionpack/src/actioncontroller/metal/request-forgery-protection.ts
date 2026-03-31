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
