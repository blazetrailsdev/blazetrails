/**
 * ActionController::ParameterEncoding
 *
 * Specify binary encoding for parameters for a given action.
 * @see https://api.rubyonrails.org/classes/ActionController/ParameterEncoding.html
 */

export interface ParameterEncoding {
  skipParameterEncoding(action: string): void;
}
