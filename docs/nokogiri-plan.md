# `@blazetrails/nokogiri` plan

Rails parallel: [nokogiri](https://github.com/sparklemotion/nokogiri) (libxml2
bindings). v1 is scoped to **actionpack assertions + activesupport XmlMini
backends only**. HTML parsing, CSS selectors, mutation, and actiontext usage
are explicitly deferred (see [Non-goals](#non-goals-v1) and
[Future expansion](#future-expansion-actiontext)).

## Engine choice

| Engine                                                      | Role                  | Why                                                                                      |
| ----------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------- |
| [`@xmldom/xmldom`](https://github.com/xmldom/xmldom) `^0.9` | DOM parser/serializer | W3C DOM Level 2, zero deps, browser-safe. Stable since 0.8; 0.9 is current. ESM via `*`. |
| [`htmlparser2`](https://github.com/fb55/htmlparser2) `^10`  | Streaming SAX events  | Used only by `SAX.Parser` (XML mode: `{ xmlMode: true, recognizeCDATA: true }`).         |

**Why not pick one engine?** xmldom's `DOMParser` produces a full DOM tree
(needed for `XmlMini_Nokogiri` `to_hash` traversal). htmlparser2 is streaming
and ~10× faster for the SAX path (`XmlMini_NokogiriSAX`). Keeping both
mirrors Rails — Nokogiri ships both DOM and SAX with distinct backends.

**Browser compatibility.** Both deps run in browsers; package will set
`"browser"` exports identical to `"default"`. Aligns with the
`trails-browser-compat` audit.

## Consumers (actionpack + activesupport only)

| Rails consumer                          | What it uses                                  | Engine      |
| --------------------------------------- | --------------------------------------------- | ----------- |
| actionpack `assertions.rb`              | `XML::Document.parse(body)` for XML responses | xmldom      |
| activesupport `xml_mini/nokogiri.rb`    | `Nokogiri::XML(data)` → DOM → `to_hash`       | xmldom      |
| activesupport `xml_mini/nokogirisax.rb` | `SAX::Parser` + `SAX::Document` handler       | htmlparser2 |

**Important:** the `to_hash` monkeypatch lives in
`active_support/xml_mini/nokogiri.rb`, not in Nokogiri itself. Our package
mirrors that boundary — `to_hash` is **not** on `XML.Document` / `XML.Node`;
it stays in `activesupport/src/xml-mini/nokogiri-engine.ts` as a free
function consuming `XML.Node`.

## Package layout

Sub-paths use the engine name in the filename to avoid `Document` ambiguity
between the DOM and SAX namespaces:

```
packages/nokogiri/
  package.json            # name: @blazetrails/nokogiri
  src/
    index.ts              # public re-exports as `XML` + `SAX` namespaces
    xml/
      document.ts         # exports `XmlDocument` (re-exported as `XML.Document`)
      node.ts             # exports `XmlNode`     (re-exported as `XML.Node`)
      parse.ts            # exports `parseXml()`
    sax/
      document.ts         # exports `SaxDocument` (re-exported as `SAX.Document`)
      parser.ts           # exports `SaxParser`   (re-exported as `SAX.Parser`)
    *.test.ts
```

`index.ts` rolls these up:

```ts
import { XmlDocument } from "./xml/document.js";
import { XmlNode } from "./xml/node.js";
import { parseXml } from "./xml/parse.js";
import { SaxDocument } from "./sax/document.js";
import { SaxParser } from "./sax/parser.js";

export const XML = { Document: XmlDocument, Node: XmlNode };
export const SAX = { Document: SaxDocument, Parser: SaxParser };
export { parseXml };
export type { XmlNode, XmlDocument, SaxDocument, SaxParser };
```

Consumers use namespaced access (`XML.Document`, `SAX.Parser`) so call
sites read like Rails; internal type-level imports use the engine-prefixed
names.

## Public surface

### Namespace mapping

| Nokogiri (Ruby)                | trails           |
| ------------------------------ | ---------------- |
| `Nokogiri::XML::Document`      | `XML.Document`   |
| `Nokogiri::XML::Node`          | `XML.Node`       |
| `Nokogiri::XML::SAX::Parser`   | `SAX.Parser`     |
| `Nokogiri::XML::SAX::Document` | `SAX.Document`   |
| `Nokogiri::XML(data)`          | `parseXml(data)` |

camelCase per CLAUDE.md: Ruby `element?` → `isElement()`, `cdata?` →
`isCdata()`, `attribute_nodes` → `attributeNodes`, etc.

### XML.Document

Wraps `new DOMParser({ onError: … }).parseFromString(data, "text/xml")`.

```ts
class XmlDocument {
  static parse(data: string): XmlDocument;
  root: XmlNode;
  errors: ReadonlyArray<XmlError>;
}

interface XmlError {
  level: "warning" | "error" | "fatal";
  message: string;
  line?: number;
  column?: number;
}
```

**Error semantics.** xmldom 0.9 exposes errors via the `DOMParser`
`onError(level, msg, ctx)` callback (deprecated `errorHandler` shape still
honored). `XmlDocument.parse` constructs the parser with a closure that
pushes `XmlError` entries onto a private array, then snapshots them onto
the returned instance. Rails calls `doc.errors.first` and raises — we
provide the same array shape so the consumer call (in
`xml-mini/nokogiri-engine.ts`) is one-line:
`if (doc.errors.length > 0) throw doc.errors[0];` (with a follow-up to
wrap in a typed error class if needed).

Rails usage:

```ruby
# actionpack — assertions.rb:19
Nokogiri::XML::Document.parse(@response.body)

# activesupport — xml_mini/nokogiri.rb:27-28
doc = Nokogiri::XML(data)
raise doc.errors.first if doc.errors.length > 0
doc.to_hash   # monkeypatch — see "Consumers" note above
```

### XML.Node

Minimal wrapper over xmldom `Node`. Only the methods our consumers call:

```ts
class XmlNode {
  name: string; // localName for elements; "#text"/"#cdata-section" otherwise
  isElement(): boolean; // nodeType === ELEMENT_NODE (1)
  isText(): boolean; // nodeType === TEXT_NODE (3)
  isCdata(): boolean; // nodeType === CDATA_SECTION_NODE (4)
  content: string; // textContent, joined recursively for elements
  children: XmlNode[]; // wrapped childNodes (length == childNodes.length)
  attributeNodes: AttrNode[];
}

interface AttrNode {
  nodeName: string;
  value: string;
}
```

Wrapper instances are constructed lazily on traversal (no whole-tree
walk on parse).

Rails usage (all from `xml_mini/nokogiri.rb`):

```ruby
children.each do |c|
  if c.element?
    c.to_hash(node_hash)
  elsif c.text? || c.cdata?
    node_hash[CONTENT_ROOT] << c.content
  end
end
attribute_nodes.each { |a| node_hash[a.node_name] = a.value }
```

### SAX.Document

Base class — consumer subclasses and overrides callbacks (Nokogiri-shape):

```ts
class SaxDocument {
  startDocument(): void {}
  endDocument(): void {}
  startElement(name: string, attrs: ReadonlyArray<[string, string]>): void {}
  endElement(name: string): void {}
  characters(text: string): void {}
  cdataBlock(text: string): void {}
  error(message: string): void {}
}
```

**`attrs` shape.** Nokogiri's `SAX::Parser` callback receives
`[[name, value], …]` tuples (the simple form — Nokogiri >= 1.4 also
supports `Nokogiri::XML::SAX::Parser::Attribute` objects with namespace
fields, but `XmlMini_NokogiriSAX` only reads `name` and `value`). We pass
the simple `[string, string][]` tuple shape; if a future consumer needs
namespaces, expand without breaking back-compat.

**CDATA in htmlparser2 XML mode.** htmlparser2 emits `oncdatastart`,
`ontext` (with the CDATA payload), `oncdataend` in sequence when
`recognizeCDATA: true`. The `SaxParser` wrapper tracks a `inCdata` flag
between `oncdatastart`/`oncdataend` and dispatches `characters` /
`cdataBlock` accordingly. Verified against `htmlparser2` 10.x event
ordering.

### SAX.Parser

```ts
class SaxParser {
  constructor(handler: SaxDocument);
  parse(data: string): void;
}
```

Internally constructs `new HtmlParser2(handler-adapter, { xmlMode: true, recognizeCDATA: true, decodeEntities: true })`,
adapter translates htmlparser2's event API to the `SaxDocument` callbacks.
`parse(data)` calls `parser.write(data); parser.end();` (htmlparser2's
streaming API used in one-shot mode for the synchronous Rails contract).

Rails usage (`xml_mini/nokogirisax.rb`):

```ruby
parser = Nokogiri::XML::SAX::Parser.new(document)
parser.parse(data)
```

## Dependencies

- Runtime:
  - `@xmldom/xmldom` `^0.9` — current major; 0.9.0 released 2024-02 with
    the modernized `onError` callback API used here.
  - `htmlparser2` `^10` — current major; 10.x is ESM-default. `xmlMode` +
    `recognizeCDATA` options are stable since 8.x.
- Dev: workspace `vitest` only — no extra dev deps.

Both deps have permissive licenses (xmldom MIT, htmlparser2 MIT) and zero
transitive runtime deps. Tracked in the package `NOTICE`.

## LOC budget

| Component                                                | LOC | Where               |
| -------------------------------------------------------- | --- | ------------------- |
| `XmlDocument.parse` + error collection + tests           | 60  | xml/document.ts     |
| `XmlNode` wrapper (predicates, content, children, attrs) | 60  | xml/node.ts         |
| `parseXml` + `index.ts` barrel                           | 30  | xml/parse.ts, index |
| Tests (DOM)                                              | 50  | xml/\*.test.ts      |
| `SaxDocument` base class                                 | 25  | sax/document.ts     |
| `SaxParser` + htmlparser2 adapter + CDATA flag           | 70  | sax/parser.ts       |
| Tests (SAX)                                              | 55  | sax/\*.test.ts      |

Totals: **PR 1 (DOM) ≈ 200 LOC, PR 2 (SAX) ≈ 150 LOC**. Both fit under the
300-LOC ceiling with margin.

## api:compare

Nokogiri is a standalone gem (not part of the Rails monorepo), so it's
not in `vendor/rails/`. Adding it to `vendor/sources.ts` and api:compare
is not worth the extractor complexity for a ~10-method surface. Parity is
tracked manually via this plan doc and the test suite. If the surface
grows significantly (actiontext expansion), revisit adding a nokogiri
source entry.

## Implementation sequence

### PR 1 — XML DOM (~200 LOC)

- New package: `packages/nokogiri/` with `package.json`,
  `tsconfig.json`, `vitest.config.ts` (workspace-standard, no surprises).
- `XmlDocument.parse`, `XmlNode` wrapper, `parseXml()`.
- Wire into actionpack `assertions.ts` `htmlDocument()` — restore the
  export that is currently held back (see comment in
  `packages/actionpack/src/action-dispatch/testing/assertions.ts`).
- Wire into activesupport `xml-mini/nokogiri-engine.ts` (new file —
  delete the placeholder if one exists; current `xml-mini/` stubs are
  `jdom-engine.test.ts`, `rexml-engine.test.ts`, `xml-mini-engine.test.ts`
  with `it.skip` only).
- Tests: parse XML → traverse → read attributes → verify errors on
  malformed input. Test names should describe Nokogiri-equivalent behavior
  but don't need to match upstream verbatim (we don't vendor Nokogiri's
  test suite).

### PR 2 — SAX (~150 LOC)

- `SaxDocument` base class with overridable callbacks.
- `SaxParser` wrapping htmlparser2 with the CDATA flag adapter.
- Wire into activesupport `xml-mini/nokogiri-sax-engine.ts`.
- Tests: streaming parse producing the same hash as the DOM path (mirror
  Rails' `XmlMini_NokogiriSAX` `HashBuilder` pattern); CDATA-block
  ordering test; entity decoding test.

## Future expansion (actiontext)

When actiontext is in scope, this package will need:

- HTML parsing (htmlparser2 DOM mode or a separate `html/` namespace).
- `.css()` selector support (likely `css-select` against the xmldom tree).
- Node mutation (`.replace()`, `.innerHtml`, `.remove()`, `.dup()`).
- Element/attribute bracket access, `.createElement()`, `.fragment()`.
- `SaveOptions.AS_HTML` serialization flag.

These are explicitly deferred — the `xml/` + `sax/` layout accommodates
adding `html/` and expanding the Node interface later without breaking
the v1 XML API.

## Non-goals (v1)

- HTML parsing (deferred to actiontext).
- CSS selectors (deferred).
- XPath, XSLT.
- Encoding detection beyond UTF-8 (xmldom accepts UTF-8 strings; the Rails
  consumers all pass UTF-8 already).
- Full W3C DOM compliance — only the methods Rails calls.
- Mutation API (`replace`, `remove`, `innerHTML=`, etc.).

## Wire-up checklist

PR 1:

- [ ] `packages/nokogiri/package.json` registered in workspace
- [ ] `XmlDocument.parse` returns instance with `root` + `errors`
- [ ] `XmlNode` predicates / `content` / `children` / `attributeNodes`
- [ ] `parseXml(data)` convenience export
- [ ] `XML` / `SAX` (`SAX` empty in PR 1) namespace barrel in `index.ts`
- [ ] `actionpack/.../assertions.ts` `htmlDocument()` wired (closes gap at line 9)
- [ ] `activesupport/src/xml-mini/nokogiri-engine.ts` written with `toHash` traversal
- [ ] Tests cover parse → traverse → attrs → malformed-input errors

PR 2:

- [ ] `SaxDocument` base class with all 7 callbacks
- [ ] `SaxParser(handler).parse(data)` with CDATA flag adapter
- [ ] `activesupport/src/xml-mini/nokogiri-sax-engine.ts` written
- [ ] DOM/SAX produce identical hashes for the Rails fixture set
- [ ] Entity decoding test + CDATA ordering test

## Risks / open questions

- **xmldom error fidelity.** xmldom warns on things libxml2 doesn't (and
  vice versa). The activesupport consumer only checks `errors.length > 0`,
  so divergence on warning messages shouldn't matter, but record any
  surprises in the v1 PR body and add fixture-based regression tests.
- **htmlparser2 entity decoding.** XML mode decodes the standard XML
  entities by default; verify against the Rails SAX hash output. If a
  consumer relies on raw entity text, we'll need
  `decodeEntities: false` instead.
- **`Document` re-export ergonomics.** The namespace object pattern
  (`XML.Document`) doesn't carry the class through TypeScript's
  `import type` narrowing as cleanly as a direct class export. Concrete
  call sites read fine; complain in code review if a particular consumer
  fights it.
