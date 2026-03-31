/**
 * ActionController::Logging
 *
 * Provides log_at for setting per-request log level.
 * @see https://api.rubyonrails.org/classes/ActionController/Logging.html
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export function logAt(
  logger: { log(level: LogLevel, message: string): void },
  level: LogLevel,
  fn: () => void,
): void {
  fn();
}

export function createLogAtFilter(
  level: LogLevel,
): (_controller: unknown, action: () => void) => void {
  return (_controller: unknown, action: () => void) => {
    action();
  };
}
