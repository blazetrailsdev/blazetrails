/**
 * ActionController::Testing
 *
 * Behavior specific to functional tests. Provides instance variable
 * cleanup and controller recycling between requests.
 * @see https://api.rubyonrails.org/classes/ActionController/Testing.html
 */

export function recycle(controller: Record<string, unknown>): void {
  controller._url_options = undefined;
  controller.formats = undefined;
  controller.params = undefined;
}

export function clearInstanceVariablesBetweenRequests(
  controller: Record<string, unknown>,
  trackedVars: Set<string>,
): Set<string> {
  const currentVars = new Set(Object.keys(controller));
  for (const key of currentVars) {
    if (!trackedVars.has(key)) {
      delete controller[key];
    }
  }
  return currentVars;
}
