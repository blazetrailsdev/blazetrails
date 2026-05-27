// libxml2-wasm uses top-level await — incompatible with Rollup IIFE format.
export const XML = { Document: null as never, Node: null as never };
export const SAX = { Document: null as never, Parser: null as never };
export function parseXml(): never {
  throw new Error("nokogiri not available in service worker");
}
export class SaxDocument {}
export class SaxParser {}
