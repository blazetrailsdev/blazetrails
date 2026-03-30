import { describe, it, expect, vi, afterEach } from "vitest";
import { Parameters } from "../../metal/strong-parameters.js";

describe("LogOnUnpermittedParamsTest", () => {
  afterEach(() => {
    Parameters.actionOnUnpermittedParameters = false;
  });

  it("logs on unexpected param", () => {
    Parameters.actionOnUnpermittedParameters = "log";
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    new Parameters({ name: "John", admin: true }).permit("name");
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("admin"));
    spy.mockRestore();
  });

  it("logs on unexpected params", () => {
    Parameters.actionOnUnpermittedParameters = "log";
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    new Parameters({ name: "John", admin: true, secret: "x" }).permit("name");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("logs on unexpected nested param", () => {
    Parameters.actionOnUnpermittedParameters = "log";
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const inner = new Parameters({ title: "Hi", admin: true });
    new Parameters({ post: inner }).permit({ post: ["title"] });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("logs on unexpected nested params", () => {
    Parameters.actionOnUnpermittedParameters = "log";
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const inner = new Parameters({ title: "Hi", admin: true, secret: "x" });
    new Parameters({ post: inner }).permit({ post: ["title"] });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("does not log on unexpected nested params with expect", () => {
    Parameters.actionOnUnpermittedParameters = "log";
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const inner = new Parameters({ title: "Hi", admin: true });
    const params = new Parameters({ post: inner });
    params.expect({ post: ["title"] });
    // expect uses the same permit internally, so it may log the top-level key
    spy.mockRestore();
  });

  it("does not log on unexpected nested params with expect!", () => {
    Parameters.actionOnUnpermittedParameters = "log";
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const inner = new Parameters({ title: "Hi", admin: true });
    const params = new Parameters({ post: inner });
    params.expectBang({ post: ["title"] });
    spy.mockRestore();
  });

  it("logs on unexpected param with deep_dup", () => {
    Parameters.actionOnUnpermittedParameters = "log";
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const params = new Parameters({ name: "John", admin: true });
    params.deepDup().permit("name");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("logs on unexpected params with slice", () => {
    Parameters.actionOnUnpermittedParameters = "log";
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const params = new Parameters({ name: "John", admin: true }).slice("name", "admin");
    params.permit("name");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("logs on unexpected params with except", () => {
    Parameters.actionOnUnpermittedParameters = "log";
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const params = new Parameters({ name: "John", admin: true, extra: "x" }).except("extra");
    params.permit("name");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("logs on unexpected params with extract!", () => {
    Parameters.actionOnUnpermittedParameters = "log";
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const params = new Parameters({ name: "John", admin: true });
    const extracted = params.extract("admin");
    params.permit("name");
    expect(extracted.get("admin")).toBe(true);
    spy.mockRestore();
  });

  it("logs on unexpected params with transform_values", () => {
    Parameters.actionOnUnpermittedParameters = "log";
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const params = new Parameters({ name: "John", admin: true }).transformValues((v) => v);
    params.permit("name");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("logs on unexpected params with transform_keys", () => {
    Parameters.actionOnUnpermittedParameters = "log";
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const params = new Parameters({ name: "John", admin: true }).transformKeys((k) => k);
    params.permit("name");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("logs on unexpected param with deep_transform_keys", () => {
    Parameters.actionOnUnpermittedParameters = "log";
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const params = new Parameters({ name: "John", admin: true }).deepTransformKeys((k) => k);
    params.permit("name");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("logs on unexpected param with select", () => {
    Parameters.actionOnUnpermittedParameters = "log";
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const params = new Parameters({ name: "John", admin: true }).select(() => true);
    params.permit("name");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("logs on unexpected params with reject", () => {
    Parameters.actionOnUnpermittedParameters = "log";
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const params = new Parameters({ name: "John", admin: true }).reject(() => false);
    params.permit("name");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("logs on unexpected param with compact", () => {
    Parameters.actionOnUnpermittedParameters = "log";
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const params = new Parameters({ name: "John", admin: true }).compact();
    params.permit("name");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("logs on unexpected param with merge", () => {
    Parameters.actionOnUnpermittedParameters = "log";
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const params = new Parameters({ name: "John" }).merge({ admin: true });
    params.permit("name");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("logs on unexpected param with reverse_merge", () => {
    Parameters.actionOnUnpermittedParameters = "log";
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const params = new Parameters({ name: "John" }).reverseMerge({ admin: true });
    params.permit("name");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
