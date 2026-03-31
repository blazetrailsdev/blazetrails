/**
 * ActionController::Flash
 *
 * Flash message integration for controllers.
 * @see https://api.rubyonrails.org/classes/ActionController/Flash.html
 */

export interface Flash {
  flash: Record<string, unknown>;
  notice: unknown;
  alert: unknown;
}
