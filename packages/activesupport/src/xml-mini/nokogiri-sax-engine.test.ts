import { describe, it, expect } from "vitest";
import { parseXmlToHash } from "./nokogiri-engine.js";
import { parseXmlToHashSax } from "./nokogiri-sax-engine.js";

describe("NokogiriSAXEngineTest", () => {
  it("produces same hash as DOM for simple element", async () => {
    const xml = "<root/>";
    expect(await parseXmlToHashSax(xml)).toEqual(await parseXmlToHash(xml));
  });

  it("produces same hash as DOM for element with attributes", async () => {
    const xml = '<root type="integer" name="foo"/>';
    expect(await parseXmlToHashSax(xml)).toEqual(await parseXmlToHash(xml));
  });

  it("produces same hash as DOM for element with text content", async () => {
    const xml = "<root>hello world</root>";
    expect(await parseXmlToHashSax(xml)).toEqual(await parseXmlToHash(xml));
  });

  it("produces same hash as DOM for nested elements", async () => {
    const xml = '<products><book type="novel"><title>Dune</title></book></products>';
    expect(await parseXmlToHashSax(xml)).toEqual(await parseXmlToHash(xml));
  });

  it("produces same hash as DOM for repeated elements", async () => {
    const xml = "<items><item>a</item><item>b</item></items>";
    expect(await parseXmlToHashSax(xml)).toEqual(await parseXmlToHash(xml));
  });

  it("children with simple cdata", async () => {
    const xml = "<root><![CDATA[cdata text]]></root>";
    expect(await parseXmlToHashSax(xml)).toEqual(await parseXmlToHash(xml));
  });

  it("children with text and cdata", async () => {
    const xml = "<root>before<![CDATA[middle]]>after</root>";
    expect(await parseXmlToHashSax(xml)).toEqual(await parseXmlToHash(xml));
  });

  it("decodes entities in content", async () => {
    const xml = "<root>&amp;&lt;&gt;</root>";
    const result = (await parseXmlToHashSax(xml)) as { root: { __content__: string } };
    expect(result.root.__content__).toBe("&<>");
  });

  it("throws on malformed xml", async () => {
    await expect(parseXmlToHashSax("<root>")).rejects.toThrow();
  });
});
