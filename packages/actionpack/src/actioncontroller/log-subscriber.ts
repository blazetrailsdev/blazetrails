/**
 * ActionController::LogSubscriber
 *
 * Log formatting for controller actions.
 * @see https://api.rubyonrails.org/classes/ActionController/LogSubscriber.html
 */

export class LogSubscriber {
  startProcessing(_event: { payload: Record<string, unknown> }): void {
    // Log start of processing
  }

  processAction(_event: { payload: Record<string, unknown>; duration: number }): void {
    // Log action processing
  }

  halted(_event: { payload: Record<string, unknown> }): void {
    // Log halted callback
  }

  sendFile(_event: { payload: Record<string, unknown> }): void {
    // Log send_file
  }

  sendData(_event: { payload: Record<string, unknown> }): void {
    // Log send_data
  }

  redirect(_event: { payload: Record<string, unknown> }): void {
    // Log redirect
  }
}
