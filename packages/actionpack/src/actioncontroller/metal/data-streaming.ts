/**
 * ActionController::DataStreaming
 *
 * Methods for sending arbitrary data and for streaming files to the browser.
 * @see https://api.rubyonrails.org/classes/ActionController/DataStreaming.html
 */

import * as fs from "fs";
import * as path from "path";
import { MissingFile } from "./exceptions.js";

export const DEFAULT_SEND_FILE_TYPE = "application/octet-stream";
export const DEFAULT_SEND_FILE_DISPOSITION = "attachment";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".txt": "text/plain",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".xml": "application/xml",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".csv": "text/csv",
};

export function inferContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return MIME_TYPES[ext] ?? DEFAULT_SEND_FILE_TYPE;
}

export function buildSendFileHeaders(options: {
  filename?: string;
  type?: string;
  disposition?: string;
}): Record<string, string> {
  const headers: Record<string, string> = {};
  const contentType =
    options.type ??
    (options.filename ? inferContentType(options.filename) : DEFAULT_SEND_FILE_TYPE);
  headers["content-type"] = contentType;

  const disposition = options.disposition ?? DEFAULT_SEND_FILE_DISPOSITION;
  if (disposition && options.filename) {
    headers["content-disposition"] = `${disposition}; filename="${options.filename}"`;
  } else if (disposition) {
    headers["content-disposition"] = disposition;
  }

  headers["content-transfer-encoding"] = "binary";
  return headers;
}

export function readFileForSend(filePath: string): globalThis.Buffer {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new MissingFile(`Cannot read file ${filePath}`);
  }
  return fs.readFileSync(filePath);
}
