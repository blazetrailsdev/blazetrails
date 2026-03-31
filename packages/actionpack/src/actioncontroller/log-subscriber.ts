/**
 * ActionController::LogSubscriber
 *
 * Log formatting for controller actions.
 * @see https://api.rubyonrails.org/classes/ActionController/LogSubscriber.html
 */

export class LogSubscriber {
  startProcessing(event: { payload: Record<string, unknown> }): void {
    // Log start of processing
  }

  processAction(event: { payload: Record<string, unknown>; duration: number }): void {
    // Log action processing
  }

  halted(event: { payload: Record<string, unknown> }): void {
    // Log halted callback
  }

  sendFile(event: { payload: Record<string, unknown> }): void {
    // Log send_file
  }

  sendData(event: { payload: Record<string, unknown> }): void {
    // Log send_data
  }

  redirect(event: { payload: Record<string, unknown> }): void {
    // Log redirect
  }
}
