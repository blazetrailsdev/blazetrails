/**
 * Mirrors the `RequestFormat`, `RequestMimeType`, and supporting clusters in
 * `actionpack/test/dispatch/request_test.rb`. Covers the
 * ActionDispatch::Http::MimeNegotiation mixin once it's wired onto Request.
 *
 * NOTE: the legacy `Request#format` getter (string) and `Request#variant`
 * accessors are still in place — wiring those to the mixin requires updating
 * call sites across `action-controller` and is tracked as a follow-up. These
 * tests exercise the wired methods that don't collide with legacy names.
 */

import { describe, expect, it } from "vitest";

import { Request } from "./request.js";
import { MimeType } from "./mime-type.js";
import "./mime-types.js";

describe("Request::MimeNegotiation (wired)", () => {
  describe("content_mime_type", () => {
    it("returns Mime[:html] for text/html", () => {
      const r = new Request({ CONTENT_TYPE: "text/html" });
      expect(r.contentMimeType).toBe(MimeType.HTML);
    });

    it("returns Mime[:xml] for application/xml", () => {
      const r = new Request({ CONTENT_TYPE: "application/xml" });
      expect(r.contentMimeType?.symbol).toBe("xml");
    });

    it("strips parameters from CONTENT_TYPE", () => {
      const r = new Request({ CONTENT_TYPE: "application/xml; charset=UTF-8" });
      expect(r.contentMimeType?.symbol).toBe("xml");
    });

    it("returns null when CONTENT_TYPE is absent", () => {
      const r = new Request({});
      expect(r.contentMimeType).toBeNull();
    });

    it("caches the parsed value in env", () => {
      const r = new Request({ CONTENT_TYPE: "text/html" });
      expect(r.contentMimeType).toBe(MimeType.HTML);
      r.env["CONTENT_TYPE"] = "application/json";
      expect(r.contentMimeType).toBe(MimeType.HTML);
    });
  });

  describe("has_content_type?", () => {
    it("is true when CONTENT_TYPE is present", () => {
      expect(new Request({ CONTENT_TYPE: "text/html" }).hasContentType()).toBe(true);
    });

    it("is false when CONTENT_TYPE is absent", () => {
      expect(new Request({}).hasContentType()).toBe(false);
    });
  });

  describe("accepts", () => {
    it("parses HTTP_ACCEPT into MimeTypes", () => {
      const r = new Request({ HTTP_ACCEPT: "text/html,application/xml;q=0.9" });
      const symbols = r.accepts.map((m) => m.symbol);
      expect(symbols).toContain("html");
      expect(symbols).toContain("xml");
    });

    it("returns [content_mime_type] when HTTP_ACCEPT is blank", () => {
      const r = new Request({ CONTENT_TYPE: "application/json" });
      expect(r.accepts).toHaveLength(1);
      expect(r.accepts[0]?.symbol).toBe("json");
    });
  });

  describe("formats", () => {
    it("formats text/html with accept header", () => {
      const r = new Request({ HTTP_ACCEPT: "text/html" });
      expect(r.formats).toEqual([MimeType.HTML]);
    });

    it("formats blank with accept header falls back to html", () => {
      const r = new Request({ HTTP_ACCEPT: "" });
      expect(r.formats).toEqual([MimeType.HTML]);
    });

    it("formats XMLHttpRequest with accept header falls back to js", () => {
      const r = new Request({ HTTP_X_REQUESTED_WITH: "XMLHttpRequest" });
      expect(r.formats).toEqual([MimeType.JS]);
    });

    it("formats application/xml with accept header", () => {
      const r = new Request({
        CONTENT_TYPE: "application/xml; charset=UTF-8",
        HTTP_X_REQUESTED_WITH: "XMLHttpRequest",
      });
      expect(r.formats.map((m) => m.symbol)).toEqual(["xml"]);
    });

    it("format taken from the path extension", () => {
      const r1 = new Request({ PATH_INFO: "/foo.xml", QUERY_STRING: "" });
      expect(r1.formats.map((m) => m.symbol)).toEqual(["xml"]);
      const r2 = new Request({ PATH_INFO: "/foo.123", QUERY_STRING: "" });
      expect(r2.formats).toEqual([MimeType.HTML]);
    });

    it("formats from accept headers have higher precedence than path extension", () => {
      const r = new Request({
        HTTP_ACCEPT: "application/json",
        PATH_INFO: "/foo.xml",
        QUERY_STRING: "",
      });
      expect(r.formats.map((m) => m.symbol)).toEqual(["json"]);
    });
  });

  describe("negotiate_mime", () => {
    it("returns null when no formats match", () => {
      const r = new Request({
        HTTP_ACCEPT: "text/html",
        HTTP_X_REQUESTED_WITH: "XMLHttpRequest",
      });
      const xml = MimeType.lookup("xml")!;
      const json = MimeType.lookup("json")!;
      expect(r.negotiateMime([xml, json])).toBeNull();
    });

    it("returns the first matching format", () => {
      const r = new Request({
        HTTP_ACCEPT: "text/html",
        HTTP_X_REQUESTED_WITH: "XMLHttpRequest",
      });
      const xml = MimeType.lookup("xml")!;
      expect(r.negotiateMime([xml, MimeType.HTML])?.symbol).toBe("html");
    });
  });

  describe("setFormat / setFormats", () => {
    it("setFormat updates the format via parameters[:format]", () => {
      const r = new Request({});
      r.setFormat("json");
      expect(r.params["format"]).toBe("json");
      expect(r.formats[0]?.symbol).toBe("json");
    });

    it("setFormats accepts an ordered list", () => {
      const r = new Request({});
      r.setFormats(["xml", "html"]);
      expect(r.formats.map((m) => m?.symbol)).toEqual(["xml", "html"]);
    });
  });

  describe("ignoreAcceptHeader", () => {
    it("static accessor flips formats to fall back to html", () => {
      const prev = Request.ignoreAcceptHeader();
      Request.setIgnoreAcceptHeader(true);
      try {
        const r = new Request({ HTTP_ACCEPT: "application/xml", QUERY_STRING: "" });
        expect(r.formats).toEqual([MimeType.HTML]);
      } finally {
        Request.setIgnoreAcceptHeader(prev);
      }
    });
  });

  describe("shouldApplyVaryHeader", () => {
    it("is true with a non-browser-like Accept and no format param", () => {
      const r = new Request({ HTTP_ACCEPT: "application/json" });
      expect(r.shouldApplyVaryHeader()).toBe(true);
    });

    it("is false when a format param is present", () => {
      const r = new Request({
        HTTP_ACCEPT: "application/json",
        "action_dispatch.request.parameters": { format: "xml" },
      });
      expect(r.shouldApplyVaryHeader()).toBe(false);
    });
  });
});
