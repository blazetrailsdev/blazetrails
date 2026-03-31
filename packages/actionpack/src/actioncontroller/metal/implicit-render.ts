/**
 * ActionController::ImplicitRender
 *
 * Handles implicit rendering for a controller action that does not
 * explicitly respond with render, respond_to, redirect, or head.
 * @see https://api.rubyonrails.org/classes/ActionController/ImplicitRender.html
 */

export interface ImplicitRender {
  defaultRender(): void;
}
