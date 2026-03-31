/**
 * ActionController::DataStreaming
 *
 * Re-exports send_file/send_data helpers from ActionDispatch.
 * @see https://api.rubyonrails.org/classes/ActionController/DataStreaming.html
 */

export {
  sendFile,
  sendData,
  type SendFileOptions,
  type SendDataOptions,
} from "../../actiondispatch/send-file.js";

export const DEFAULT_SEND_FILE_TYPE = "application/octet-stream";
export const DEFAULT_SEND_FILE_DISPOSITION = "attachment";

export interface DataStreaming {
  sendFile(path: string, options?: Record<string, unknown>): void;
  sendData(data: string | Buffer, options?: Record<string, unknown>): void;
}
