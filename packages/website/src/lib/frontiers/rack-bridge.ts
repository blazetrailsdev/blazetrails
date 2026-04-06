/**
 * Converts between the fetch API (Request/Response) and Rack's env/response
 * tuple format. Runs in the service worker to bridge iframe fetch events
 * to the in-browser Rack app.
 *
 * No Node.js dependencies — uses only browser APIs.
 */

import type { RackEnv, RackResponse, RackBody } from "@blazetrails/rack";

class StringIO {
  private _data: string;
  constructor(data = "") {
    this._data = data;
  }
  read(): string {
    return this._data;
  }
  write(s: string): void {
    this._data += s;
  }
  string(): string {
    return this._data;
  }
  get size(): number {
    return new TextEncoder().encode(this._data).byteLength;
  }
}

/**
 * Build a Rack env dict from a fetch Request.
 * `basePath` is stripped from the URL before setting PATH_INFO
 * (e.g. "/~dev" so that "/~dev/users" becomes "/users").
 */
export function requestToRackEnv(request: Request, basePath = ""): RackEnv {
  const url = new URL(request.url);

  let pathInfo = decodeURIComponent(url.pathname);
  if (basePath && pathInfo.startsWith(basePath)) {
    pathInfo = pathInfo.slice(basePath.length) || "/";
  }

  const env: RackEnv = {
    REQUEST_METHOD: request.method.toUpperCase(),
    PATH_INFO: pathInfo,
    QUERY_STRING: url.search ? url.search.slice(1) : "",
    SERVER_NAME: url.hostname,
    SERVER_PORT: url.port || (url.protocol === "https:" ? "443" : "80"),
    SERVER_PROTOCOL: "HTTP/1.1",
    SCRIPT_NAME: "",
    HTTPS: url.protocol === "https:" ? "on" : "off",
    "rack.url_scheme": url.protocol.replace(":", ""),
    "rack.input": new StringIO(),
    "rack.errors": new StringIO(),
  };

  // Copy request headers as CGI-style HTTP_* keys
  request.headers.forEach((value, key) => {
    const normalized = key.toLowerCase();
    if (normalized === "content-type") {
      env["CONTENT_TYPE"] = value;
    } else if (normalized === "content-length") {
      env["CONTENT_LENGTH"] = value;
    } else {
      env[`HTTP_${key.toUpperCase().replace(/-/g, "_")}`] = value;
    }
  });

  return env;
}

/**
 * Variant that also reads the request body (async).
 * Use this for POST/PUT/PATCH requests.
 */
export async function requestToRackEnvWithBody(request: Request, basePath = ""): Promise<RackEnv> {
  const env = requestToRackEnv(request, basePath);

  if (request.body && request.method !== "GET" && request.method !== "HEAD") {
    const body = await request.text();
    env["rack.input"] = new StringIO(body);
    if (!env["CONTENT_LENGTH"]) {
      env["CONTENT_LENGTH"] = String(new TextEncoder().encode(body).byteLength);
    }
  }

  return env;
}

/**
 * Convert a Rack response tuple to a fetch Response.
 */
export async function rackResponseToFetchResponse(rackResponse: RackResponse): Promise<Response> {
  const [status, headers, body] = rackResponse;

  const bodyText = await collectBody(body);

  return new Response(bodyText, {
    status,
    headers: new Headers(headers),
  });
}

async function collectBody(body: RackBody): Promise<string> {
  const chunks: string[] = [];
  for await (const chunk of body) {
    chunks.push(typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk));
  }
  return chunks.join("");
}
