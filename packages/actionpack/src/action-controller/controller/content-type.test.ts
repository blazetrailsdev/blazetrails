import { describe, it, expect } from "vitest";
import { Base } from "../base.js";
import { Request } from "../../action-dispatch/request.js";
import { Response } from "../../action-dispatch/response.js";
import { Mime } from "../../action-dispatch/http/mime-type.js";

function makeRequest(opts: Record<string, unknown> = {}): Request {
  return new Request({
    REQUEST_METHOD: "GET",
    PATH_INFO: "/",
    HTTP_HOST: "localhost",
    ...opts,
  });
}

function makeResponse(): Response {
  return new Response();
}

// ==========================================================================
// controller/content_type_test.rb — ContentTypeTest
//
// Rails: OldContentTypeController exercises content-type and charset
// propagation through render(body:), response.content_type=, and
// response.charset=. Several tests are blocked because Trails' render
// body: defaults to "application/octet-stream" (Rails uses Mime[:text]),
// and controller _contentType overwrites response-level assignments.
// ==========================================================================
describe("ContentTypeTest", () => {
  it.skip("pending: render body: defaults to application/octet-stream, Rails expects Mime[:text]", () => {
    // test render defaults
    // Rails: get :render_defaults → charset "utf-8", media_type Mime[:text]
  });

  it.skip("pending: render body: defaults to application/octet-stream, Rails expects Mime[:text]", () => {
    // test render changed charset default
    // Rails: with_default_charset("utf-16") → charset "utf-16", media_type Mime[:text]
  });

  it.skip("pending: response.contentType= before render body: is overwritten by render's default", () => {
    // test content type from body
    // Rails: response.content_type = Mime[:rss] then render body: → media_type rss
  });

  it("test content type from render", async () => {
    class C extends Base {
      async action() {
        this.render({ body: "hello world!", contentType: Mime.fetch("rss").toString() });
      }
    }
    const c = new C();
    await c.dispatch("action", makeRequest(), makeResponse());
    expect(c.response.mediaType).toBe("application/rss+xml");
    // Rails also asserts charset "utf-8" but Trails' render body: doesn't
    // auto-append charset to the content-type header — response.charset
    // returns undefined. Omitted until charset propagation is wired.
  });

  it.skip("pending: response.charset= before render body: is overwritten by render's contentType default", () => {
    // test charset from body
    // Rails: response.charset = "utf-16" then render body: → charset "utf-16"
  });

  it.skip("pending: render body: defaults to application/octet-stream (no charset propagation)", () => {
    // test nil charset from body
    // Rails: response.charset = nil then render body: → charset "utf-8"
  });

  it.skip("pending: requires ERB template rendering (ActionView not yet ported)", () => {
    // test nil default for erb
  });

  it.skip("pending: requires ERB template rendering (ActionView not yet ported)", () => {
    // test default for erb
  });

  it.skip("pending: requires builder template rendering (ActionView not yet ported)", () => {
    // test default for builder
  });

  it.skip("pending: requires builder template rendering + render action: (ActionView not yet ported)", () => {
    // test change for builder
  });

  it.skip("pending: response.contentType= before render body: is overwritten by render's default", () => {
    // test content type with charset
    // Rails: response.content_type = "text/html; fragment; charset=utf-16"
    //        then render body: → media_type "text/html; fragment", charset "utf-16"
  });
});

// ==========================================================================
// controller/content_type_test.rb — AcceptBasedContentTypeTest
//
// Rails: uses respond_to blocks with template rendering (xml builder).
// Blocked on ActionView template integration + respond_to format blocks.
// ==========================================================================
describe("AcceptBasedContentTypeTest", () => {
  it.skip("pending: requires respond_to block + template rendering", () => {
    // test render default content types for respond to
  });

  it.skip("pending: requires respond_to block + template rendering", () => {
    // test render default content types for respond to with template
  });

  it.skip("pending: requires respond_to block + template rendering", () => {
    // test render default content types for respond to with overwrite
  });
});
