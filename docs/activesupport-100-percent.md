# ActiveSupport: Road to 100% Test Coverage

Current state: **77.9%** (2,229 / 2,862 total Ruby tests). 549 skipped, 156/157 files matched, 12 misplaced.

## How coverage is measured

The compare script (`pnpm run test:compare`) extracts test names from both Rails Ruby source and our TypeScript tests, then matches them by normalized description. "Skipped" means `it.skip()` stubs that match a Ruby test name. The goal is to convert all skips to real passing tests.

## What's left

### Biggest gaps (sorted by total missing + skipped)

| File                        | OK  | Skipped | Missing | Total |
| --------------------------- | --- | ------- | ------- | ----- |
| time-with-zone              | 172 | 7       | 0       | 179   |
| hash-ext                    | 44  | 44      | 5       | 93    |
| time-zone                   | 99  | 9       | 0       | 108   |
| xml-mini                    | 12  | 31      | 4       | 47    |
| mem-cache-store             | 0   | 35      | 0       | 35    |
| redis-cache-store           | 0   | 27      | 1       | 28    |
| share-lock                  | 0   | 25      | 0       | 25    |
| inflector                   | 50  | 6       | 0       | 56    |
| date-and-time-compatibility | 0   | 21      | 0       | 21    |
| xml-mini-engine             | 0   | 20      | 0       | 20    |
| string-ext                  | 130 | 17      | 1       | 148   |
| json/encoding               | 29  | 17      | 0       | 46    |
| number-helper-i18n          | 0   | 16      | 0       | 16    |
| encrypted-file              | 0   | 15      | 0       | 15    |
| log-subscriber              | 0   | 15      | 0       | 15    |
| message-encryptor           | 0   | 2       | 13      | 15    |
| array/conversions           | 13  | 12      | 0       | 25    |
| encrypted-configuration     | 0   | 12      | 0       | 12    |
| time-ext                    | 99  | 9       | 11      | 119   |
| date-ext                    | 44  | 9       | 3       | 56    |
| deep-dup                    | 10  | 0       | 0       | 10    |
| ordered-hash                | 34  | 8       | 0       | 42    |
| safe-buffer                 | 34  | 7       | 0       | 41    |
| transliterate               | 9   | 7       | 0       | 16    |
| current-attributes          | 15  | 6       | 0       | 21    |

### Fully skipped files (0 passing tests)

These have test files but no passing tests yet:

- **mem-cache-store** (35 skipped) — needs memcached adapter
- **redis-cache-store** (27 skipped) — needs Redis adapter
- **share-lock** (25 skipped) — thread concurrency, fundamentally hard in JS
- **date-and-time-compatibility** (21 skipped)
- **xml-mini-engine** (20 skipped)
- **number-helper-i18n** (16 skipped) — depends on i18n
- **encrypted-file** (15 skipped) — encryption infrastructure
- **log-subscriber** (15 skipped)
- **encrypted-configuration** (12 skipped) — depends on encrypted-file

## Completed

- **deep-dup** — 10/10 tests passing (was 0/10)
- **inflector** — 50/56 tests passing (was 35/56), +15 tests: acronyms, humanize rules, clear/reset, uncountables
- **class** — 6/6 tests passing (was 0/6): descendants, subclasses, reloading
- **object/with** — 6/6 tests passing (was 0/6): set/restore around blocks
- **attr-internal** — 5/5 tests passing (was 0/5): reader, writer, accessor, naming format
- **load-error** — 4/4 tests passing (was 0/4): require/load error handling
- **json/decoding** — 4/4 tests passing (was 0/4): decode, fragments, error handling
- **execution-context** — 4/4 tests passing (was 0/4): set/restore, key coercion
- **environment-inquirer** — 2/2 tests passing (was 0/2): local predicate
- **current-attributes** — 17/21 tests passing (was 15/21): restricted names, method_added hook

## Recommended next targets

### Highest ROI (big gap, mostly implementation work)

1. **hash-ext** (44 skipped, 5 missing) — all skipped tests are `HashToXmlTest`, needs XML serialization
2. **time-ext** (9 skipped, 11 missing) — already at 99/119
3. **date-ext** (9 skipped, 3 missing) — already at 44/56
4. **transliterate** (7 skipped) — 9/16, transliteration rules
5. **current-attributes** (6 skipped) — 15/21, callbacks and fiber-local

### Medium effort

6. **ordered-hash** (8 skipped) — all YAML serialization (blocked)
7. **safe-buffer** (7 skipped) — mix of YAML (blocked) and others
8. **time-zone** (9 skipped) — already at 99/108
9. **json/encoding** (17 skipped) — many need ActiveSupport JSON encoder
10. **message-encryptor** (2 skipped, 13 missing) — crypto implementation

### Hard / blocked

- **mem-cache-store** (35) — needs external memcached adapter
- **redis-cache-store** (27) — needs external Redis adapter
- **share-lock** (25) — JS is single-threaded, concurrency primitives don't map well
- **encrypted-file / encrypted-configuration** (27 combined) — encryption infrastructure
- **xml-mini / xml-mini-engine** (51 combined) — XML parsing infrastructure
- **ordered-hash / safe-buffer** YAML tests — no YAML library

### Not applicable to TypeScript

- **inflector**: constantize, safe_constantize (Ruby class resolution)
- **inflector**: pluralize with fallback, parameterize with locale, inflector locality (i18n)
- **string-ext**: StringConversionsTest (13 skipped) — Ruby string-to-time parsing

## Tracking progress

```bash
pnpm run test:compare -- --package activesupport
```

Target: 2,862/2,862 tests matched, 0 skipped, 0 misplaced.
