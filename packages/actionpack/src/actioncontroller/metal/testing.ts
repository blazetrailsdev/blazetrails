/**
 * ActionController::Testing
 *
 * Behavior specific to functional tests.
 * @see https://api.rubyonrails.org/classes/ActionController/Testing.html
 */

export interface Testing {
  recycle(): void;
}

export interface Functional {
  clearInstanceVariablesBetweenRequests(): void;
  recycle(): void;
}
