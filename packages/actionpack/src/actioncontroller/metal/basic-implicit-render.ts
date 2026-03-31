/**
 * ActionController::BasicImplicitRender
 *
 * Provides default_render that sends head :no_content
 * when no explicit render has been performed.
 * @see https://api.rubyonrails.org/classes/ActionController/BasicImplicitRender.html
 */

export interface BasicImplicitRender {
  defaultRender(): void;
}
