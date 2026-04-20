# ActiveRecord::Encryption: Road to 100%

Current: **15/28 files at 100%**. Overall encryption surface has **~25
methods missing** across 13 files.

```bash
# Full encryption status
pnpm run api:compare -- --package activerecord 2>&1 | rg '^  encryption'

# Missing methods per file
pnpm tsx scripts/api-compare/compare.ts --package activerecord --missing
```

Related:

- [ActiveRecord: Road to 100%](./activerecord-100-percent.md) — the broader parent plan.
- [Attr-type wiring follow-up #4](../.claude/projects/-home-dean-github-blazetrailsdev-trails/memory/project_attr_wiring_followups.md) — tracking the consolidation of the two `EncryptedAttributeType` classes that must land as part of this effort.

## Constraints (non-negotiable)

1. **Browser-compatible.** The encryption subpath must run in a browser
   with zero `node:*` imports at the module level. Node-only work is
   delegated through `@blazetrails/activesupport`'s `getCrypto()` /
   `getCryptoAsync()` crypto adapter — browser apps register a WASM or
   Web-Crypto-backed adapter via `cryptoAdapterConfig.adapter = "..."`.
2. **Not bundled by default.** Users must `import` from an explicit
   subpath; the root `@blazetrails/activerecord` barrel does NOT pull
   encryption into the default build. Follows the existing pattern for
   `@blazetrails/activesupport/message-verifier`,
   `/message-encryptor`, `/key-generator`, and
   `@blazetrails/activerecord/connection-handling` (all subpath-only
   because they pull in Node-only or heavy dependencies).
3. **Rails fidelity first.** Every new method mirrors its Rails
   equivalent: same name (camelCased), same signature, same
   public/protected split. Read `encryption/*.rb` in the Rails source
   before implementing anything.
4. **No stubs.** Every method ships with real behavior. A missing
   method is better than one returning `null` to pass api:compare.

## The two-class consolidation (blocker PR)

**This lands first.** The repo currently has two `EncryptedAttributeType`
classes:

- `packages/activerecord/src/encrypted-attribute-type.ts` — simple,
  Encryptor-based (used by `Base.encrypts()`).
- `packages/activerecord/src/encryption/encrypted-attribute-type.ts` —
  Scheme-based, Rails-faithful (used by `EncryptableRecord.encrypts()`,
  but the test suite is currently all `.skip`ped).

Consolidation onto the scheme-based class is the gate because:

- The legacy simple class lives in the root barrel (`index.ts`), so
  reaching the Rails-faithful surface means routing `Base.encrypts` to
  the scheme path.
- Until consolidation, any new scheme-surface method has to be
  mirrored in both classes.

### Consolidation steps (PR 0)

1. **Move `Base.encrypts` to route through `EncryptableRecord.encrypts`**
   (scheme-based). Requires a thin `Scheme`-from-`Encryptor` adapter:
   wrap the incoming simple encrypt/decrypt pair in a stub
   `Scheme` whose `encryptor` is a `NullEncryptor`-derived shim that
   delegates to the provided functions. Two fidelity-preserving details:
   - When no encryptor option is passed, `Base.encrypts(name)` uses the
     globally-configured scheme (already produced by `Scheme.default`),
     so there's nothing to wrap — the shim is only needed for custom
     `{ encryptor }` options.
   - Preserve `defaultEncryptor` as a re-export from the compat path so
     existing user code doesn't break.
2. **Delete `packages/activerecord/src/encrypted-attribute-type.ts`**
   and update `applyColumnsHash` / the model-schema duck-type check to
   hit exactly one `WrappedType` implementor.
3. **Remove the root `index.ts` exports of encryption symbols**
   (`encrypts`, `defaultEncryptor`, `isEncryptedAttribute`,
   `EncryptedAttributeType`, `Encryptor` type). Re-export from a new
   subpath `@blazetrails/activerecord/encryption` instead.
4. **Add the subpath to `packages/activerecord/package.json`**:

   ```json
   "./encryption": {
     "types": "./dist/encryption/index.d.ts",
     "default": "./dist/encryption/index.js"
   },
   "./encryption/*": {
     "types": "./dist/encryption/*.d.ts",
     "default": "./dist/encryption/*.js"
   }
   ```

5. **Migration note in CLAUDE.md** — users now write
   `import { encrypts } from "@blazetrails/activerecord/encryption"`.
6. **Browser compat audit** — grep the entire `encryption/` tree for
   `node:*` imports; there should be **zero**. Tests may use `node:crypto`
   freely (they don't ship). Confirm `msgpackr` is pure-JS (it is).

**Gate:** PR 0 merges only after `pnpm api:compare` shows no regression
and `pnpm tsc --noEmit` is clean with the subpath-only imports.

## Rails-faithful method gaps (by file)

Ordered by smallest-blast-radius first. Each PR covers one logical
block; aim for ≤ 20 methods per PR per the repo's size limit.

### PR 1 — `binary?` / `isBinary` predicate on every encryptor

**Files, 1 method each:**

- `encryption/null-encryptor.ts`
- `encryption/read-only-null-encryptor.ts` (also `encrypted? → isEncrypted`)
- `encryption/message-serializer.ts`
- `encryption/message-pack-message-serializer.ts`
- `encryption/encryptor.ts`

**Rails behavior:** `binary?` returns `true` when the serializer or
encryptor produces binary output (MessagePack, compressed payloads).
The Scheme and the Message consult it to decide between
`ActiveModel::Type::Binary` vs `ActiveModel::Type::String` casting.

**Implementation:** each class returns the Rails-faithful static
answer (`MessageSerializer#binary? => false`,
`MessagePackMessageSerializer#binary? => true`, etc.). For
`Encryptor#binary?` the answer is `serializer.binary?`. For
`ReadOnlyNullEncryptor#encrypted?` always returns `true` (it fakes a
fully-encrypted-looking state). 6 methods across 5 files.

**Test matrix:** each class's existing `.test.ts` gets a one-liner
asserting the predicate; no new test files.

### PR 2 — `Encryptor` compression surface

**File:** `encryption/encryptor.ts` (3 missing: `compressor`,
`compress?` → `isCompress`, plus `binary?` from PR 1 already).

**Rails behavior:** `Encryptor` gains a `compressor` reader and a
`compress?` predicate that reads `@compress` (passed via
`EncryptorOptions`). When `compress? === true`, `serialize_message`
runs MessagePack output through `compressor.deflate` before
encrypting. Already half-wired — `EncryptorOptions.compress` /
`.compressor` are accepted by the constructor; this PR exposes the
readers and consults them in the message flow. Add a
`LegacyCompressor` backed by `node:zlib`-adapter (via activesupport)
AND a `Uint8ArrayCompressor` (WASM-friendly, no Node deps — uses
`DecompressionStream`/`CompressionStream` when available).

### PR 3 — `Scheme` merge / with_context / compatibility

**File:** `encryption/scheme.ts` (5 missing).

- `support_unencrypted_data?` → `isSupportUnencryptedData` — reads
  `Configurable.config.supportUnencryptedData`.
- `fixed?` → `isFixed` — true when the scheme has a `key:` or
  `keyProvider:` pin (deterministic schemes default to true).
- `merge(other)` — returns a new Scheme with `other`'s non-nil options
  overlaid. Used by `with_context`.
- `with_context(overrides)` — wraps the current context, yields a
  Scheme with overrides applied, restores. Needed by
  `deterministic attributes can be searched`.
- `compatible_with?(other)` → `isCompatibleWith` — two schemes are
  compatible iff their encryption-relevant options
  (`deterministic`, `downcase`, `ignoreCase`, `keyProvider` identity)
  match.

**Rails fidelity hook:** `with_context` must participate in the
`Contexts` thread/async-local stack that's already implemented — don't
introduce a new state store.

### PR 4 — `ExtendedDeterministicQueries` surface

**File:** `encryption/extended-deterministic-queries.ts` (4 missing:
`where`, `exists?` → `isExists`, `scope_for_create` → `scopeForCreate`,
`find_by` → `findBy`).

**Rails behavior:** monkey-patches Relation/Base so queries on
deterministic-encrypted attributes encrypt the LHS before comparing.
Rails' implementation hooks `where`, `find_by`, `exists?`, and
`scope_for_create` and rewrites scalar / hash conditions through the
encrypted attribute's `serialize`.

**Implementation:** matches our existing `Extension` pattern —
`extendedDeterministicQueries` already exists as a relation-side
extender with `processOrder` / `processWhere`. Add the four new
entries that mirror Rails' equivalent method signatures, and wire them
into the `Relation.prototype`-extender registry.

**Test:** an end-to-end round-trip: migrate with an encrypted column,
`Model.where(email: "x@y")` issues a query against the ciphertext.
Skipped Rails tests in `encryptable-record.test.ts` unskip
incrementally as this PR lands.

### PR 5 — `ExtendedDeterministicUniquenessValidator#validate_each`

**File:** `encryption/extended-deterministic-uniqueness-validator.ts`
(1 missing). Wraps the standard `UniquenessValidator#validate_each` so
a `uniqueness:` validator on an encrypted deterministic column
compares against encrypted ciphertext instead of plaintext.

**Rails fidelity hook:** requires the custom class to extend
`ActiveRecord::Validations::UniquenessValidator` — verify our
uniqueness validator's `protected` hook points match Rails' before
overriding.

### PR 6 — `KeyGenerator.hashDigestClass` + `deriveKeyFrom`

**File:** `encryption/key-generator.ts` (2 missing). Both are thin:

- `hashDigestClass` reads from `Configurable.config.hashDigestClass`
  (default `"sha256"`; user-settable in config).
- `deriveKeyFrom(password, salt, keyLength)` wraps `pbkdf2` via the
  crypto adapter. Already partially wired — this PR promotes it to a
  public method and adds the config reader.

### PR 7 — `Properties.validateValueType`

**File:** `encryption/properties.ts` (1 missing). Ruby raises
`ArgumentError` when writing a non-scalar into a Properties map; our
port must match (throw `InvalidEncryptionProperties` from `errors.ts`).

### PR 8 — `EnvelopeEncryptionKeyProvider.activePrimaryKey`

**File:** `encryption/envelope-encryption-key-provider.ts` (1 missing).
Returns the primary key currently used for envelope encryption.
Mirrors Rails' `active_primary_key` reader, which wraps
`config.primary_key`.

### PR 9 — `EncryptableRecord.sourceAttributeFromPreservedAttribute`

**File:** `encryption/encryptable-record.ts` (1 missing). Rails uses
this to translate a `preserved_original_email` back to `email` when
rotating keys and writing both attributes. Straight string
manipulation — strips the configured preserved-attribute prefix.

### PR 10 — `Context` constructor + key_provider reader

**File:** `encryption/context.ts` (2 missing: constructor that captures
initial state, and the `keyProvider` reader). Touches the ambient
context that `Contexts` pushes/pops. Rails' `Context` has:

```ruby
attr_accessor :key_provider, :frozen_encryption, :key_rotation,
  :cleanup_contexts, :exception, :protected_mode_exception
```

Add the constructor + `keyProvider` getter; the other accessors likely
already exist but should be re-audited.

### PR 11 — `EncryptedFixtures` constructor

**File:** `encryption/encrypted-fixtures.ts` (1 missing). Small class
that encrypts fixture data so test suites loading encrypted models
don't need a separate seed step. Constructor accepts a collection of
fixtures, encrypts every attribute marked in
`EncryptableRecord.encryptedAttributes`. Currently a stub file — needs
real behavior or should be removed from the layout until a testing
integration uses it.

### PR 12 — Root `Encryption` module surface

**File:** `encryption.ts` (3 missing: `key_length` → `keyLength`,
`iv_length` → `ivLength`, `eager_load!` → `eagerLoadBang`).

**After consolidation (PR 0)** this file is a thin re-export module,
not the actual encryption logic. Those three methods re-export from
`Cipher` (key/iv length constants) and wire an `eagerLoadBang` that
eagerly constructs the default scheme/cipher so boot-time errors
surface early.

## Browser-compat verification

Each PR in the series must pass a browser-compat smoke test. Add a
new CI job `browser-smoke-encryption` that:

1. Spawns a headless Chromium via Playwright.
2. Loads a Vite-built bundle that imports `@blazetrails/activerecord/encryption`
   and `@blazetrails/activerecord/encryption/encryptor`.
3. Runs a round-trip: `new Encryptor().encrypt("hello", options) → decrypt`
   against a registered browser crypto adapter.

The adapter is the decisive bit:

- Node: already works (`getCryptoAsync()` auto-registers the Node
  adapter on import).
- Browser: users register a WASM adapter (documented examples:
  `@noble/ciphers` for AES-GCM, `js-crypto-pbkdf` for PBKDF2). Ship a
  reference adapter in `@blazetrails/activesupport/crypto-adapter-noble`
  (new subpath, not in the default barrel) — roughly 80 LoC that
  translates `noble` + `SubtleCrypto` into the existing sync
  `CryptoAdapter` interface.

**Gate:** any PR that adds a `node:*` import to an encryption source
file — even transitively — fails CI. The smoke job imports the
encryption subpath against a JSDOM runtime that throws on `node:*`
resolution.

## How to work on this

- Each PR is independent (pick any, except PR 0 comes first).
- Work in a worktree. Open a draft PR. Run `/link <pr>` so webhook
  reviews land in the pane.
- **Always read the Rails source** for the method you're implementing
  before writing TypeScript. Copy the semantics, not the Ruby idioms.
- Run `pnpm api:compare -- --package activerecord 2>&1 | rg encryption`
  after each PR to confirm the coverage bump.
- Tests in `packages/activerecord/src/encryption/*.test.ts` contain
  dozens of `it.skip(...)` placeholders that map directly to Rails'
  encryption test suite. Unskip them as the backing methods land; do
  not rename them (api:compare matches on test names).

## Order of operations summary

| PR  | Scope                                               |      Methods | Files |
| --- | --------------------------------------------------- | -----------: | ----: |
| 0   | Consolidate EncryptedAttributeType, move to subpath | — (refactor) |    ~6 |
| 1   | `binary?` / `encrypted?` predicates                 |            6 |     5 |
| 2   | Encryptor compression surface                       |            2 |     1 |
| 3   | Scheme merge / with_context / compatibility         |            5 |     1 |
| 4   | ExtendedDeterministicQueries                        |            4 |     1 |
| 5   | ExtendedDeterministicUniquenessValidator            |            1 |     1 |
| 6   | KeyGenerator hash digest + derive                   |            2 |     1 |
| 7   | Properties.validateValueType                        |            1 |     1 |
| 8   | EnvelopeEncryptionKeyProvider.activePrimaryKey      |            1 |     1 |
| 9   | EncryptableRecord source-attribute translation      |            1 |     1 |
| 10  | Context constructor + keyProvider                   |            2 |     1 |
| 11  | EncryptedFixtures constructor                       |            1 |     1 |
| 12  | Encryption module surface (keyLength, eagerLoad!)   |            3 |     1 |

**Expected end state:** 28/28 encryption files at 100%, overall
activerecord coverage bumps by ~29 methods, and
`@blazetrails/activerecord` default bundle loses the
encryption weight entirely.
