import { describe, it, expect } from "vitest";
import { parseXmlToHash } from "./nokogiri-engine.js";

describe("NokogiriEngineTest", () => {
  it("one node document as hash", async () => {
    expect(await parseXmlToHash("<root/>")).toEqual({ root: {} });
  });

  it("one node with attributes document as hash", async () => {
    expect(await parseXmlToHash('<root type="integer"/>')).toEqual({ root: { type: "integer" } });
  });

  it("single node with content as hash", async () => {
    expect(await parseXmlToHash("<root>hello</root>")).toEqual({ root: { __content__: "hello" } });
  });

  it("products node with book node as hash", async () => {
    const result = await parseXmlToHash("<products><book/></products>");
    expect(result).toEqual({ products: { book: {} } });
  });

  it("products node with two book nodes as hash", async () => {
    const result = await parseXmlToHash("<products><book/><book/></products>");
    expect(result).toEqual({ products: { book: [{}, {}] } });
  });

  it("children with children", async () => {
    const xml = "<root><child><grandchild/></child></root>";
    expect(await parseXmlToHash(xml)).toEqual({ root: { child: { grandchild: {} } } });
  });

  it("children with simple cdata", async () => {
    const xml = "<root><![CDATA[simple]]></root>";
    expect(await parseXmlToHash(xml)).toEqual({ root: { __content__: "simple" } });
  });

  it("children with text and cdata", async () => {
    const xml = "<root>before<![CDATA[cdata]]>after</root>";
    const result = (await parseXmlToHash(xml)) as { root: { __content__: string } };
    expect(result.root.__content__).toContain("cdata");
  });

  it("throws on malformed xml", async () => {
    await expect(parseXmlToHash("<root>")).rejects.toThrow();
  });

  it("decodes entities in content", async () => {
    const result = (await parseXmlToHash("<root>&amp;&lt;&gt;</root>")) as {
      root: { __content__: string };
    };
    expect(result.root.__content__).toBe("&<>");
  });
});
