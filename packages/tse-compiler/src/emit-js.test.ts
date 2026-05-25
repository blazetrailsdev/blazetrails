import { describe, it, expect } from "vitest";
import { compileJs } from "./emit-js.js";

describe("compileJs", () => {
  it("emits a render function with the Rails-shaped dispatch", () => {
    const { code } = compileJs("<h1><%= name %></h1>");
    expect(code).toBe(
      [
        "export default function render(context, locals) {",
        "  const _ob = context.outputBuffer;",
        '  _ob.safeAppend("<h1>");',
        "  _ob.append(name);",
        '  _ob.safeAppend("</h1>");',
        "  return _ob;",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("dispatches expression sites by escape mode and indicator", () => {
    expect(compileJs("<%= n %>").code).toContain("_ob.append(n);");
    expect(compileJs("<%= n %>", { escapeIgnore: true }).code).toContain("_ob.safeExprAppend(n);");
    expect(compileJs("<%== n %>").code).toContain("_ob.safeExprAppend(n);");
    expect(compileJs("<% const x = 1 %>").code).toContain("const x = 1;");
  });

  it("emits block-expr without closing paren, closed by matching code closer", () => {
    // `_ob.append(` stays open; `})` from template closes arrow body + forEach;
    // emitter appends `);` to close the append call → `}));`
    const src = "<%= forEach(items, (item) => { %><li><%= item %></li><% }) %>";
    const { code } = compileJs(src);
    expect(code).toBe(
      [
        "export default function render(context, locals) {",
        "  const _ob = context.outputBuffer;",
        "  _ob.append(forEach(items, (item) => {",
        '  _ob.safeAppend("<li>");',
        "  _ob.append(item);",
        '  _ob.safeAppend("</li>");',
        "  }));",
        "  return _ob;",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("handles nested block expressions", () => {
    const src = "<%= outer((x) => { %><%= inner((y) => { %><% }) %><% }) %>";
    const { code } = compileJs(src);
    const lines = code.split("\n");
    expect(lines).toContain("  _ob.append(outer((x) => {");
    expect(lines).toContain("  _ob.append(inner((y) => {");
    expect(lines.filter((l) => l === "  }));")).toHaveLength(2);
  });

  it("respects escapeIgnore for block-expr", () => {
    const src = "<%= fn((x) => { %><% }) %>";
    const { code } = compileJs(src, { escapeIgnore: true });
    expect(code).toContain("_ob.safeExprAppend(fn((x) => {");
    expect(code).toContain("}));");
  });
});
