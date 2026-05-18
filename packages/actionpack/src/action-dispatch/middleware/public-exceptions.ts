/**
 * ActionDispatch::PublicExceptions
 *
 * When called, this middleware renders an error page. By default if an HTML
 * response is expected it will render static error pages from the `/public`
 * directory. For example when this middleware receives a 500 response it will
 * render the template found in `/public/500.html`. If an internationalized
 * locale is set, this middleware will attempt to render the template in
 * `/public/500.<locale>.html`. If an internationalized template is not found
 * it will fall back on `/public/500.html`.
 *
 * When a request with a content type other than HTML is made, this middleware
 * will attempt to convert error information into the appropriate response
 * type.
 *
 * Port of `actionpack/lib/action_dispatch/middleware/public_exceptions.rb`.
 */

import { I18n, getFs } from "@blazetrails/activesupport";
import type { RackEnv, RackResponse } from "@blazetrails/rack";
import { bodyFromString, HTTP_STATUS_CODES } from "@blazetrails/rack";
import { X_CASCADE } from "../constants.js";
import { InvalidType } from "../http/mime-negotiation.js";
import { MimeType } from "../http/mime-type.js";

const DEFAULT_CHARSET = "utf-8";

type ErrorBody = { status: number; error: string };

export class PublicExceptions {
  publicPath: string;

  constructor(publicPath: string) {
    this.publicPath = publicPath;
  }

  async call(env: RackEnv): Promise<RackResponse> {
    const pathInfo = String(env["PATH_INFO"] ?? "");
    const status = parseInt(pathInfo.slice(1), 10) || 0;

    let contentType: MimeType | undefined;
    try {
      contentType = this.firstFormat(env);
    } catch (e) {
      if (e instanceof InvalidType) {
        contentType = MimeType.lookup("text");
      } else {
        throw e;
      }
    }

    const body: ErrorBody = {
      status,
      error: HTTP_STATUS_CODES[status as keyof typeof HTTP_STATUS_CODES] ?? HTTP_STATUS_CODES[500],
    };

    return this.render(status, contentType, body);
  }

  private firstFormat(env: RackEnv): MimeType | undefined {
    const accept = String(env["HTTP_ACCEPT"] ?? "").trim();
    if (accept === "") return MimeType.lookup("html");
    const parsed = MimeType.parse(accept);
    return parsed[0];
  }

  private render(status: number, contentType: MimeType | undefined, body: ErrorBody): RackResponse {
    const sym = contentType?.symbol;
    if (sym === "json") {
      return this.renderFormat(status, contentType!, JSON.stringify(body));
    }
    if (sym === "xml") {
      return this.renderFormat(status, contentType!, toXml(body));
    }
    return this.renderHtml(status);
  }

  private renderFormat(status: number, contentType: MimeType, body: string): RackResponse {
    const bytes = Buffer.byteLength(body, "utf8");
    return [
      status,
      {
        "content-type": `${contentType}; charset=${DEFAULT_CHARSET}`,
        "content-length": String(bytes),
      },
      bodyFromString(body),
    ];
  }

  private renderHtml(status: number): RackResponse {
    const localized = `${this.publicPath}/${status}.${I18n.locale}.html`;
    let path = localized;
    let found = getFs().existsSync(path);
    if (!found) {
      path = `${this.publicPath}/${status}.html`;
      found = getFs().existsSync(path);
    }

    if (found) {
      const html = getFs().readFileSync(path, "utf8");
      const htmlType = MimeType.lookup("html") ?? new MimeType("text/html", "html");
      return this.renderFormat(status, htmlType, html);
    }
    return [404, { [X_CASCADE]: "pass" }, bodyFromString("")];
  }
}

function toXml(body: ErrorBody): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<hash>\n` +
    `  <status type="integer">${body.status}</status>\n` +
    `  <error>${escapeXml(body.error)}</error>\n` +
    `</hash>\n`
  );
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
