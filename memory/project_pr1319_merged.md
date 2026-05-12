---
name: PR #1319 base.rb 8 methods wired
description: base.rb reached 100%; extractor SCHEMA_VERSION not bumped after _-prefix filter change
type: project
---

PR #1319 merged. base.rb 277/277 (100%), AR 99.6%→99.7% (4955/4969).

**Why:** Wired 8 missing base.rb methods: 6 TokenFor (declare on Base, BC-3 blocks eager import) + 2 Querying privates (_queryBySql/\_loadFromSql via declare static, extractor fixed to allow _-prefixed PropertyDeclaration).

**SCHEMA_VERSION not bumped** after changing the extractor's _-prefix filter in extract-ts-api.ts. Stale caches will silently miss newly-allowed _-prefixed PropertyDeclaration methods until source files change.

**How to apply:** Next time extractor logic changes, bump SCHEMA_VERSION in extract-ts-api.ts. Outstanding follow-ups:

- Bump SCHEMA_VERSION = 5 (or current+1)
- Rails manifest extractor bug: TokenDefinition struct methods attributed to TokenFor module (not TokenDefinition)
- generateTokenFor not wired to all Base instances (only added via generatesTokenFor())
- \_queryBySql/\_loadFromSql implementation gaps vs Rails (pre-existing)
