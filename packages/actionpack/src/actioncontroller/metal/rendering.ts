/**
 * ActionController::Rendering
 *
 * Render dispatch module mixed into controllers.
 * @see https://api.rubyonrails.org/classes/ActionController/Rendering.html
 */

export interface Rendering {
  render(options?: Record<string, unknown>): void;
  renderToString(options?: Record<string, unknown>): string;
}

export const RENDER_FORMATS_IN_PRIORITY = ["body", "plain", "html"] as const;
