/**
 * ActionController::Instrumentation
 *
 * Adds instrumentation to process_action, render, and send_file.
 * Accepts a Notifications-compatible interface for publishing events.
 * @see https://api.rubyonrails.org/classes/ActionController/Instrumentation.html
 */

export interface Notifier {
  instrument(event: string, payload: Record<string, unknown>, block?: () => unknown): void;
}

export function instrumentAction(
  controllerName: string,
  actionName: string,
  request: { method?: string; path?: string; format?: string },
  fn: () => Promise<unknown>,
  notifier?: Notifier,
): Promise<unknown> {
  const start = performance.now();
  const payload: Record<string, unknown> = {
    controller: controllerName,
    action: actionName,
    method: request.method,
    path: request.path,
    format: request.format,
  };

  notifier?.instrument("start_processing.action_controller", payload);

  return fn().then(
    (result) => {
      payload.status = 200;
      payload.duration = performance.now() - start;
      notifier?.instrument("process_action.action_controller", payload);
      return result;
    },
    (error) => {
      payload.status = 500;
      payload.exception = error instanceof Error ? [error.name, error.message] : String(error);
      payload.duration = performance.now() - start;
      notifier?.instrument("process_action.action_controller", payload);
      throw error;
    },
  );
}

export function instrumentRender(
  fn: () => unknown,
  notifier?: Notifier,
): { result: unknown; viewRuntime: number } {
  const start = performance.now();
  const result = fn();
  const viewRuntime = performance.now() - start;
  notifier?.instrument("render.action_controller", { duration: viewRuntime });
  return { result, viewRuntime };
}
