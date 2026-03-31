/**
 * ActionController::PermissionsPolicy
 *
 * Permissions policy header helpers for controllers.
 * @see https://api.rubyonrails.org/classes/ActionController/PermissionsPolicy.html
 */

export interface PermissionsPolicy {
  permissionsPolicy(options?: Record<string, unknown>): void;
}
