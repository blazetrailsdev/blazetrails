/**
 * ActionController::TemplateAssertions
 *
 * Template-related test assertions.
 * @see https://api.rubyonrails.org/classes/ActionController/TemplateAssertions.html
 */

export interface TemplateAssertions {
  assertTemplate(expected: string | RegExp | null): void;
}
