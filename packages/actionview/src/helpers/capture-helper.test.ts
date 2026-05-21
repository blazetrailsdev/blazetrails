import { describe, it, expect, beforeEach } from "vitest";

import { OutputBuffer } from "../buffers.js";
import { OutputFlow } from "../flows.js";
import {
  capture,
  contentFor,
  contentForQuestion,
  provide,
  withOutputBuffer,
  type CaptureHelperHost,
} from "./capture-helper.js";
import { contentTag } from "./tag-helper.js";
import { raw } from "./output-safety-helper.js";

interface Host extends CaptureHelperHost {
  capture: typeof capture;
  contentFor: typeof contentFor;
  contentForQuestion: typeof contentForQuestion;
  provide: typeof provide;
  withOutputBuffer: typeof withOutputBuffer;
}

function makeHost(): Host {
  return {
    outputBuffer: new OutputBuffer(),
    viewFlow: new OutputFlow(),
    capture,
    contentFor,
    contentForQuestion,
    provide,
    withOutputBuffer,
  };
}

describe("CaptureHelperTest", () => {
  let av: Host;

  beforeEach(() => {
    av = makeHost();
  });

  it("test_capture_captures_the_temporary_output_buffer_in_its_block", () => {
    expect(av.outputBuffer!.isEmpty()).toBe(true);
    const string = av.capture(() => {
      av.outputBuffer!.concat("foo");
      av.outputBuffer!.concat("bar");
    });
    expect(av.outputBuffer!.isEmpty()).toBe(true);
    expect(string?.toString()).toBe("foobar");
  });

  it("test_capture_captures_the_value_returned_by_the_block_if_the_temporary_buffer_is_blank", () => {
    const string = av.capture((a: string, b: string) => a + b, "foo", "bar");
    expect(string?.toString()).toBe("foobar");
  });

  it("test_capture_returns_nil_if_the_returned_value_is_not_a_string", () => {
    expect(av.capture(() => 1)).toBeNull();
  });

  it("test_capture_escapes_html", () => {
    const string = av.capture(() => "<em>bar</em>");
    expect(string?.toString()).toBe("&lt;em&gt;bar&lt;/em&gt;");
  });

  it("test_capture_doesnt_escape_twice", () => {
    const string = av.capture(() => raw("&lt;em&gt;bar&lt;/em&gt;"));
    expect(string?.toString()).toBe("&lt;em&gt;bar&lt;/em&gt;");
  });

  it("test_capture_does_not_reassign_buffer", () => {
    const original = av.outputBuffer;
    av.capture(() => {
      expect(av.outputBuffer).toBe(original);
    });
  });

  it("test_content_for_used_for_read", () => {
    av.contentFor("foo", "foo");
    expect(av.contentFor("foo")?.toString()).toBe("foo");

    av.contentFor("bar", undefined, undefined, () => "bar");
    expect(av.contentFor("bar")?.toString()).toBe("bar");
  });

  it("test_content_for_with_multiple_calls", () => {
    expect(av.contentForQuestion("title")).toBe(false);
    av.contentFor("title", "foo");
    av.contentFor("title", "bar");
    expect(av.contentFor("title")?.toString()).toBe("foobar");
  });

  it("test_content_for_with_multiple_calls_and_flush", () => {
    expect(av.contentForQuestion("title")).toBe(false);
    av.contentFor("title", "foo");
    av.contentFor("title", "bar", { flush: true });
    expect(av.contentFor("title")?.toString()).toBe("bar");
  });

  it("test_content_for_with_block", () => {
    expect(av.contentForQuestion("title")).toBe(false);
    av.contentFor("title", undefined, undefined, () => {
      av.outputBuffer!.concat("foo");
      av.outputBuffer!.concat("bar");
      return null;
    });
    expect(av.contentFor("title")?.toString()).toBe("foobar");
  });

  it("test_content_for_with_block_and_multiple_calls_with_flush", () => {
    expect(av.contentForQuestion("title")).toBe(false);
    av.contentFor("title", undefined, undefined, () => "foo");
    av.contentFor("title", undefined, { flush: true }, () => "bar");
    expect(av.contentFor("title")?.toString()).toBe("bar");
  });

  it("test_content_for_with_block_and_multiple_calls_with_flush_nil_content", () => {
    expect(av.contentForQuestion("title")).toBe(false);
    av.contentFor("title", undefined, undefined, () => "foo");
    av.contentFor("title", null, { flush: true }, () => "bar");
    expect(av.contentFor("title")?.toString()).toBe("bar");
  });

  it("test_content_for_with_block_and_multiple_calls_without_flush", () => {
    expect(av.contentForQuestion("title")).toBe(false);
    av.contentFor("title", undefined, undefined, () => "foo");
    av.contentFor("title", undefined, { flush: false }, () => "bar");
    expect(av.contentFor("title")?.toString()).toBe("foobar");
  });

  it("test_content_for_with_whitespace_block", () => {
    expect(av.contentForQuestion("title")).toBe(false);
    av.contentFor("title", "foo");
    av.contentFor("title", undefined, undefined, () => {
      av.outputBuffer!.concat("  \n  ");
      return null;
    });
    av.contentFor("title", "bar");
    expect(av.contentFor("title")?.toString()).toBe("foobar");
  });

  it("test_content_for_with_whitespace_block_and_flush", () => {
    expect(av.contentForQuestion("title")).toBe(false);
    av.contentFor("title", "foo");
    av.contentFor("title", undefined, { flush: true }, () => {
      av.outputBuffer!.concat("  \n  ");
      return null;
    });
    av.contentFor("title", "bar", { flush: true });
    expect(av.contentFor("title")?.toString()).toBe("bar");
  });

  it("test_content_for_returns_nil_when_writing", () => {
    expect(av.contentForQuestion("title")).toBe(false);
    expect(av.contentFor("title", "foo")).toBeNull();
    expect(
      av.contentFor("title", undefined, undefined, () => {
        av.outputBuffer!.concat("bar");
        return null;
      }),
    ).toBeNull();
    expect(
      av.contentFor("title", undefined, undefined, () => {
        av.outputBuffer!.concat("  \n  ");
        return null;
      }),
    ).toBeNull();
    expect(av.contentFor("title")?.toString()).toBe("foobar");
    expect(av.contentFor("title", "foo", { flush: true })).toBeNull();
    expect(
      av.contentFor("title", undefined, { flush: true }, () => {
        av.outputBuffer!.concat("bar");
        return null;
      }),
    ).toBeNull();
    expect(
      av.contentFor("title", undefined, { flush: true }, () => {
        av.outputBuffer!.concat("  \n  ");
        return null;
      }),
    ).toBeNull();
    expect(av.contentFor("title")?.toString()).toBe("bar");
  });

  it("test_content_for_returns_nil_when_content_missing", () => {
    expect(av.contentFor("some_missing_key")).toBeNull();
  });

  it("test_content_for_question_mark", () => {
    expect(av.contentForQuestion("title")).toBe(false);
    av.contentFor("title", "title");
    expect(av.contentForQuestion("title")).toBe(true);
    expect(av.contentForQuestion("something_else")).toBe(false);
  });

  it("test_content_for_should_be_html_safe_after_flush_empty", () => {
    expect(av.contentForQuestion("title")).toBe(false);
    av.contentFor("title", undefined, undefined, () => contentTag("p", "title"));
    expect(av.contentFor("title")!.htmlSafe).toBe(true);
    av.contentFor("title", "", { flush: true });
    av.contentFor("title", undefined, undefined, () => contentTag("p", "title"));
    expect(av.contentFor("title")!.htmlSafe).toBe(true);
  });

  it("test_provide", () => {
    expect(av.contentForQuestion("title")).toBe(false);
    av.provide("title", "hi");
    expect(av.contentForQuestion("title")).toBe(true);
    expect(av.contentFor("title")?.toString()).toBe("hi");
    av.provide("title", "<p>title</p>");
    expect(av.contentFor("title")?.toString()).toBe("hi&lt;p&gt;title&lt;/p&gt;");

    av.viewFlow = new OutputFlow();
    av.provide("title", "hi");
    av.provide("title", raw("<p>title</p>"));
    expect(av.contentFor("title")?.toString()).toBe("hi<p>title</p>");
  });

  it("test_with_output_buffer_swaps_the_output_buffer_given_no_argument", () => {
    expect(av.outputBuffer!.isEmpty()).toBe(true);
    const buffer = av.withOutputBuffer(null, () => {
      av.outputBuffer!.concat(".");
    });
    expect(buffer.toString().toString()).toBe(".");
    expect(av.outputBuffer!.isEmpty()).toBe(true);
  });

  it("test_with_output_buffer_swaps_the_output_buffer_with_an_argument", () => {
    expect(av.outputBuffer!.isEmpty()).toBe(true);
    const buffer = new OutputBuffer(".");
    av.withOutputBuffer(buffer, () => {
      av.outputBuffer!.concat(".");
    });
    expect(buffer.toString().toString()).toBe("..");
    expect(av.outputBuffer!.isEmpty()).toBe(true);
  });

  it("test_with_output_buffer_restores_the_output_buffer", () => {
    const buffer = new OutputBuffer();
    av.outputBuffer = buffer;
    av.withOutputBuffer(null, () => {
      av.outputBuffer!.concat(".");
    });
    expect(buffer).toBe(av.outputBuffer);
  });

  it("test_with_output_buffer_does_not_assume_there_is_an_output_buffer", () => {
    expect(av.outputBuffer!.isEmpty()).toBe(true);
    expect(
      av
        .withOutputBuffer(null, () => {})
        .toString()
        .toString(),
    ).toBe("");
  });

  it("test_ignore_the_block_return_if_its_the_buffer", () => {
    av.outputBuffer!.safeConcat("something");
    const string = av.capture(() => {
      av.outputBuffer!.concat("foo");
      av.outputBuffer!.concat("bar");
      return av.outputBuffer;
    });
    expect(string?.toString()).toBe("foobar");
  });
});
