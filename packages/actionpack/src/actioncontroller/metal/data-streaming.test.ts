/**
 * Tests for DataStreaming private methods
 */

import { describe, it, expect } from "vitest";
import { sendFileHeadersBang } from "./data-streaming.js";

describe("sendFileHeadersBang", () => {
  it("sets content-type and content-transfer-encoding", () => {
    const headers: Record<string, string> = {};
    const controller = {
      contentType: "text/plain" as string | null,
      response: {
        setHeader(name: string, value: string) {
          headers[name] = value;
        },
      },
    };

    sendFileHeadersBang.call(controller as any, { type: "text/plain" });

    expect(controller.contentType).toBe("text/plain");
    expect(headers["content-transfer-encoding"]).toBe("binary");
  });

  it("sets content-disposition with attachment (default)", () => {
    const headers: Record<string, string> = {};
    const controller = {
      contentType: null as string | null,
      response: {
        setHeader(name: string, value: string) {
          headers[name] = value;
        },
      },
    };

    sendFileHeadersBang.call(controller as any, {
      type: "application/octet-stream",
      filename: "document.pdf",
    });

    expect(headers["content-disposition"]).toBe('attachment; filename="document.pdf"');
  });

  it("sets content-disposition with inline disposition", () => {
    const headers: Record<string, string> = {};
    const controller = {
      contentType: null as string | null,
      response: {
        setHeader(name: string, value: string) {
          headers[name] = value;
        },
      },
    };

    sendFileHeadersBang.call(controller as any, {
      type: "image/jpeg",
      disposition: "inline",
      filename: "image.jpg",
    });

    expect(headers["content-disposition"]).toBe('inline; filename="image.jpg"');
  });

  it("infers mime type from filename when type not provided", () => {
    const headers: Record<string, string> = {};
    const controller = {
      contentType: null as string | null,
      response: {
        setHeader(name: string, value: string) {
          headers[name] = value;
        },
      },
    };

    sendFileHeadersBang.call(controller as any, {
      filename: "document.pdf",
    });

    expect(controller.contentType).toBe("application/pdf");
  });

  it("handles non-ASCII filenames with RFC 5987 encoding", () => {
    const headers: Record<string, string> = {};
    const controller = {
      contentType: null as string | null,
      response: {
        setHeader(name: string, value: string) {
          headers[name] = value;
        },
      },
    };

    sendFileHeadersBang.call(controller as any, {
      type: "text/plain",
      filename: "文档.txt",
      disposition: "attachment",
    });

    expect(headers["content-disposition"]).toContain("filename*=UTF-8''");
    expect(headers["content-disposition"]).toContain("%E6%96%87%E6%A1%A3.txt");
  });

  it("throws error when type is null", () => {
    const controller = {
      contentType: null as string | null,
      response: {
        setHeader() {},
      },
    };

    expect(() => {
      sendFileHeadersBang.call(controller as any, { type: null });
    }).toThrow(":type option required");
  });
});
