/**
 * ActionController::LogSubscriber
 *
 * Log formatting for controller actions. Subscribes to
 * ActiveSupport::Notifications events.
 * @see https://api.rubyonrails.org/classes/ActionController/LogSubscriber.html
 */

export class LogSubscriber {
  private _logger: { info(msg: string): void; debug?(msg: string): void } | null;

  constructor(logger?: { info(msg: string): void; debug?(msg: string): void }) {
    this._logger = logger ?? null;
  }

  startProcessing(event: { payload: Record<string, unknown> }): void {
    const { controller, action, format } = event.payload;
    this._logger?.info(`Processing by ${controller}#${action} as ${format ?? "*/*"}`);
  }

  processAction(event: { payload: Record<string, unknown>; duration: number }): void {
    const { status } = event.payload;
    this._logger?.info(`Completed ${status} in ${event.duration.toFixed(1)}ms`);
  }

  halted(event: { payload: Record<string, unknown> }): void {
    const { filter } = event.payload;
    this._logger?.info(`Filter chain halted as ${filter} rendered or redirected`);
  }

  sendFile(event: { payload: Record<string, unknown> }): void {
    const { path } = event.payload;
    this._logger?.info(`Sent file ${path}`);
  }

  sendData(event: { payload: Record<string, unknown> }): void {
    const { filename } = event.payload;
    this._logger?.info(`Sent data ${filename ?? "(inline)"}`);
  }

  redirect(event: { payload: Record<string, unknown> }): void {
    const { status, location } = event.payload;
    this._logger?.info(`Redirected to ${location} (${status})`);
  }
}
