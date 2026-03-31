/**
 * ActionController::DataStreaming
 *
 * Provides send_file and send_data for streaming data to the browser.
 * @see https://api.rubyonrails.org/classes/ActionController/DataStreaming.html
 */

export interface DataStreaming {
  sendFile(
    path: string,
    options?: { type?: string; disposition?: string; filename?: string },
  ): void;
  sendData(
    data: string | Buffer,
    options?: { type?: string; disposition?: string; filename?: string },
  ): void;
}

export const DEFAULT_SEND_FILE_TYPE = "application/octet-stream";
export const DEFAULT_SEND_FILE_DISPOSITION = "attachment";
