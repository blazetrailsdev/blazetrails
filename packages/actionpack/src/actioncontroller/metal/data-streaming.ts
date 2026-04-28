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

// --- Private helpers ---

export interface SendFileHeadersHost {
  contentType: string | null;
  response: {
    setHeader(name: string, value: string): void;
  };
}

/**
 * Sets Content-Type, Content-Disposition, and Content-Transfer-Encoding headers
 * based on options provided to send_file/send_data.
 */
export function sendFileHeadersBang(
  this: SendFileHeadersHost,
  options: Record<string, unknown>,
): void {
  const typeProvided = "type" in options;

  let contentType = (options.type as string | null | undefined) ?? null;

  // Only apply default if type wasn't explicitly provided
  if (!typeProvided) {
    contentType = DEFAULT_SEND_FILE_TYPE;
  } else if (contentType === null || contentType === undefined) {
    throw new Error(":type option required");
  }

  this.contentType = contentType;
  (this.response as any).sendingFile = true;

  if (
    typeof contentType === "symbol" ||
    (typeof contentType === "string" && contentType.startsWith(":"))
  ) {
    // Handle symbol-like types (though JS doesn't have symbols, Rails uses them)
    // For now, treat unknown symbol types as errors
    throw new Error(`Unknown MIME type ${options.type}`);
  }

  // If type wasn't explicitly provided, try to infer from filename extension
  if (!typeProvided && options.filename) {
    const filename = options.filename as string;
    const ext = filename.split(".").pop()?.toLowerCase();
    if (ext) {
      const inferredType = inferMimeType(ext);
      if (inferredType) {
        this.contentType = inferredType;
      }
    }
  }

  const disposition =
    (options.disposition as string | null | undefined) ?? DEFAULT_SEND_FILE_DISPOSITION;
  if (disposition) {
    const contentDisposition = formatContentDisposition(
      disposition,
      options.filename as string | undefined,
    );
    this.response.setHeader("content-disposition", contentDisposition);
  }

  this.response.setHeader("content-transfer-encoding", "binary");
}

/**
 * Infer MIME type from file extension.
 */
function inferMimeType(ext: string): string | null {
  const mimeTypes: Record<string, string> = {
    html: "text/html",
    htm: "text/html",
    txt: "text/plain",
    css: "text/css",
    js: "text/javascript",
    json: "application/json",
    xml: "application/xml",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    ico: "image/x-icon",
    pdf: "application/pdf",
    zip: "application/zip",
    gz: "application/gzip",
    csv: "text/csv",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    webm: "video/webm",
    woff: "font/woff",
    woff2: "font/woff2",
  };
  return mimeTypes[ext] ?? null;
}

/**
 * Format Content-Disposition header according to RFC 6266.
 */
function formatContentDisposition(disposition: string, filename?: string): string {
  if (!filename) return disposition;
  // Handle non-ASCII filenames with RFC 5987 encoding
  const hasNonAscii = /[^\x20-\x7E]/.test(filename);
  if (hasNonAscii) {
    const encoded = encodeURIComponent(filename);
    return `${disposition}; filename*=UTF-8''${encoded}`;
  }
  return `${disposition}; filename="${filename}"`;
}
