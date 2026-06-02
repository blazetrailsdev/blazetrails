# Encryption contexts — Rails parity plan

**Goal:** Bring the TypeScript encryption-context model to Rails parity so that
`packages/activerecord/src/encryption/contexts.test.ts` can be rewritten as a
faithful, DB-backed port of `vendor/rails/activerecord/test/cases/encryption/contexts_test.rb`
and removed from `eslint/test-fixture-parity-exclude.json`.

**Status:** Blocked — feature work required first (this doc). See memory
`project_encryption_contexts_fixture_parity_blocked`.

---

## 1. Root cause (why the faithful port fails today)

Rails has **no `encryption_disabled` / `protected_mode` flags**. Its context
mechanics are entirely _encryptor-swap + one boolean_ (`frozen_encryption`):

| Rails helper                | what it actually does                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `without_encryption`        | `with_encryption_context(encryptor: NullEncryptor.new)`                                    |
| `protecting_encrypted_data` | `with_encryption_context(encryptor: EncryptingOnlyEncryptor.new, frozen_encryption: true)` |

And the attribute type **resolves the encryptor from the context on every call**
(`vendor/.../encrypted_attribute_type.rb:150`):

```ruby
def encryptor
  ActiveRecord::Encryption.encryptor   # == context.encryptor
end
```

All observable behavior then falls out of which encryptor is in the context:

- `NullEncryptor#decrypt` returns the ciphertext unchanged, `#encrypt` returns
  the cleartext unchanged → reads return ciphertext, writes store plaintext.
- `EncryptingOnlyEncryptor#decrypt` returns ciphertext unchanged (can't decrypt)
  → reads return ciphertext; writes are blocked by the `frozen_encryption`
  validation, not by the encryptor.

The TS port diverged: it invented boolean flags `encryptionDisabled` /
`protectedMode` (`encryption/context.ts`) and the attribute type resolves the
encryptor from the **scheme** (`this._encryptor`), never from the context. The
flags are short-circuited inside `serialize`/`deserialize`. This is why the three
behaviors fail (verified by probe, 2026-06-01):

1. `with_encryption_context(encryptor: NullEncryptor)` is ignored on read —
   `post.reload.title` returns plaintext, not the ciphertext Rails asserts.
2. In "protected" mode `post.encrypt()` throws `Encryption` (not `Configuration`)
   and `post.decrypt()` throws nothing — because `protectingEncryptedData` sets
   `protectedMode`, but the encrypt/decrypt guard checks `frozenEncryption`.
3. Protected-mode `update` throws `EncryptionError "Can't write encrypted
attribute in protected mode"` instead of Rails' `RecordInvalid`.

The fix is to **delete the flags and adopt Rails' encryptor-swap model.**

---

## 2. Exact changes

Order matters — each step is independently testable. File paths are relative to
`packages/activerecord/src/`.

### Change A — resolve the encryptor from the context (the central fix)

**File:** `encryption/encrypted-attribute-type.ts`

The private `decrypt`/`encrypt` text paths use the scheme encryptor
`this._encryptor` (lines ~239 `decryptAsText`, ~312–315 `encryptAsText`, and the
`private get encryptor()` at line ~324). Change them to read the **current
context** encryptor, falling back to the scheme encryptor when no context
override is active:

```ts
// replace the `private get encryptor()` body (line ~324)
import { getEncryptionContext } from "./context.js";
// ...
private get encryptor(): EncryptorLike {
  // Mirrors Rails EncryptedAttributeType#encryptor → ActiveRecord::Encryption.encryptor.
  // TS default context carries no encryptor, so fall back to the scheme's.
  return (getEncryptionContext().encryptor as EncryptorLike | undefined) ?? this._encryptor;
}
```

Then make `decryptAsText` (line ~239) and `encryptAsText` (line ~312) call
`this.encryptor.decrypt(...)` / `this.encryptor.encrypt(...)` and
`this.encryptor.isBinary()` instead of `this._encryptor.*`.

**Why the `?? this._encryptor` fallback is correct (and not a hack):** in Rails
the default `Context` ships an `Encryptor.new`; in TS the default context is `{}`
and per-attribute encryptors (compressor / custom encryptor / message
serializer) live on the **scheme**. `Scheme#withContext`
(`encryption/scheme.ts:~100`) already pushes the scheme's encryptor onto the
context _only when the scheme has an override_ — exactly Rails'
`@context_properties.present?` gate. So:

- plain `encrypts :title` (no scheme override) → `scheme.withContext` pushes
  nothing → `encryptor` reads context (or falls back to scheme default). Under
  `without_encryption`/`protecting`, the context holds the Null/EncryptingOnly
  encryptor → correct.
- `encrypts :name, compressor: …` → `scheme.withContext` pushes the custom
  encryptor on top → wins, matching Rails' innermost-context precedence.

### Change B — drop the flag short-circuits in serialize/deserialize

**File:** `encryption/encrypted-attribute-type.ts` (lines 99–115)

Current:

```ts
deserialize(value) {
  if (value == null) return value;
  if (isEncryptionDisabled()) return value;          // DELETE
  if (isProtectedMode()) return value;               // DELETE
  const decrypted = this.decrypt(value);
  return this.castType.deserialize?.(decrypted) ?? decrypted;
}

serialize(value) {
  if (value == null) return null;
  if (isEncryptionDisabled()) return this.castType.serialize?.(value) ?? value;  // DELETE
  if (isProtectedMode() && !this.deterministic) {                                // DELETE
    throw new EncryptionError("Can't write encrypted attribute in protected mode");
  }
  if (this.isSerializeWithOldest()) return this.serializeWithOldest(value);
  return this.serializeWithCurrent(value);
}
```

After: remove all four flag branches. With Change A the encryptor swap produces
the same read results (NullEncryptor/EncryptingOnlyEncryptor return ciphertext on
decrypt; NullEncryptor returns cleartext on encrypt). The protected-mode write is
now blocked by the validation in Change D, **not** by a throw here — matching
Rails (where `protecting_encrypted_data` uses an `EncryptingOnlyEncryptor` that
_can_ encrypt; the write is stopped by `frozen_encryption`).

Remove the now-unused `isEncryptionDisabled, isProtectedMode` import (line 6).

> ⚠️ **Regression watch:** the deleted `isEncryptionDisabled` branch in
> `serialize` returned `castType.serialize(value)` directly; the new path runs
> `serializeWithCurrent` → `NullEncryptor.encrypt(castSerializedString)`. For
> string columns these are identical, but verify binary/JSON columns
> (`encryptable-record.test.ts`, the `*SerializedBinary` factories,
> `encrypting-only-encryptor.test.ts`) still round-trip — the str/Uint8Array
> coercion in `serializeWithCurrent` (lines ~295–303) must produce the same
> stored bytes that the old direct-cast path did.

### Change C — redefine the context helpers to match Rails

**File:** `encryption/context.ts`

```ts
import { NullEncryptor } from "./null-encryptor.js";
import { EncryptingOnlyEncryptor } from "./encrypting-only-encryptor.js";

export function withoutEncryption<T>(fn: () => T): T {
  return withEncryptionContext({ encryptor: new NullEncryptor() }, fn);
}

export function protectingEncryptedData<T>(fn: () => T): T {
  return withEncryptionContext(
    { encryptor: new EncryptingOnlyEncryptor(), frozenEncryption: true },
    fn,
  );
}
```

Remove `encryptionDisabled` and `protectedMode` from the `EncryptionContext`
interface (lines 51–52) and delete the now-dead `isEncryptionDisabled()` /
`isProtectedMode()` exports (lines 117–123). Grep confirms the only non-test
consumers are `context.ts` and `encrypted-attribute-type.ts`, both edited here.

> Watch for an import cycle: `context.ts` → `null-encryptor.ts`/
> `encrypting-only-encryptor.ts` → `encryptor.ts`. If any of those transitively
> import `context.ts`, lazy-`import()` inside the helper bodies (the pattern
> already used in `encrypted-fixtures.test.ts`).

### Change D — wire the frozen-write validation

**File:** `encryption/encryptable-record.ts`

`cantModifyEncryptedAttributesWhenFrozen` (line ~419) already exists but is never
registered. Register it in the `encrypts` setup as a conditional validation,
mirroring `encryptable_record.rb:13`:

```ruby
validate :cant_modify_encrypted_attributes_when_frozen,
  if: -> { has_encrypted_attributes? && ActiveRecord::Encryption.context.frozen_encryption? }
```

Using the activemodel `validate(fn, { if })` API
(`packages/activemodel/src/validations.ts:148`):

```ts
modelClass.validate(
  (record: any) => EncryptableRecord.cantModifyEncryptedAttributesWhenFrozen(record),
  {
    if: () =>
      EncryptableRecord.hasEncryptedAttributes(modelClass) &&
      getEncryptionContext().frozenEncryption === true,
  },
);
```

Register it **once per model** (guard against re-registration when `encrypts` is
called for multiple attributes — see how `validateColumnSize` dedupes via
`_validators`). This makes `post.save()`/`update` in protected mode add an error
on each changed encrypted attribute → the bang variant throws `RecordInvalid`.

### Change E — confirm encrypt/decrypt raise `Configuration` in protected mode

**File:** `encryption/encryptable-record.ts` — **no code change expected.**

`validateEncryptionAllowed` (line ~380) already throws `ConfigurationError` when
`getEncryptionContext().frozenEncryption` is set, and it runs first inside
`encryptAttributes`/`decryptAttributes`. Once Change C sets
`frozenEncryption: true` in `protectingEncryptedData`, `post.encrypt()` and
`post.decrypt()` both raise `Errors::Configuration` — matching the Rails test.
Add a test assertion only.

### Change F — expose `Configurable.encryptor`

**File:** `encryption/configurable.ts`

The nesting test asserts `ActiveRecord::Encryption.encryptor == encryptor_N`. Add
the delegating getter next to `keyProvider`/`cipher` (line ~25):

```ts
static get encryptor(): unknown {
  return Contexts.context.encryptor;
}
```

(Optional, for full `Context::PROPERTIES` delegation parity: also add
`keyGenerator` / `messageSerializer` getters — not required by this test.)

---

## 3. Rewrite the test (faithful, DB-backed)

**File:** `encryption/contexts.test.ts`

Replace the pure-function/flag assertions with the Rails bodies. Use the handler
suite + canonical models (gold standard: `encryption/encrypted-fixtures.test.ts`):

- `setupHandlerSuite()` + `useHandlerFixtures(["posts"])` to mirror Rails
  `fixtures :posts` (gives the lint rule a real `posts` accessor + transactional
  rollback). `EncryptedPost` (`test-helpers/models/post-encrypted.ts`) is already
  `_tableName = "posts"`.
- `beforeEach`: `configureEncryption()`, `supportUnencryptedData = true`, then
  `const post = await EncryptedPost.create({ title: "Some encrypted post title", body: "Some body" })`;
  capture `titleCiphertext = post.ciphertextFor("title")`.
- Port each Rails body verbatim (do **not** rename tests — CLAUDE.md):
  - `lets you override properties` → `withEncryptionContext({ encryptor: new NullEncryptor() }, …)`, assert `(await post.reload()).title === titleCiphertext`, then `update`, assert `readAttributeBeforeTypeCast("title") === "Some new title"`.
  - `restore … on error` → throw inside the context, `catch`, then
    `assertEncryptedAttribute(await post.reload(), "title", titleCleartext)`.
  - `nested multiple times` → assert `Configurable.encryptor === e1/e2/e3` at each level.
  - `without_encryption won't decrypt …` → `assertNotEncryptedAttribute` after write (**add this helper** to `encryption/test-helpers.ts` — it has `assertEncryptedAttribute` but not the negative).
  - `protecting … don't decrypt` / `allows db-queries on deterministic attributes`
    (use `EncryptedBook.findBy({ name: "Dune" })`).
  - `can't encrypt or decrypt in protected mode` → `expect(post.encrypt()).rejects` / `decrypt()` → `Errors::Configuration` (Change E).
  - `will raise a validation error …` → protected-mode update rejects with
    `RecordInvalid` (Change D). Use the throwing update variant.
- Keep the existing TS-only `defaultContext is visible …` test (no Rails
  counterpart, not in the parity map) — but update it to the encryptor model
  instead of `keyProvider` flags if it references removed APIs.

---

## 4. Verification & sequencing

1. **Per-change unit runs** (do not run the whole suite — CLAUDE.md):
   - `pnpm vitest run packages/activerecord/src/encryption/encrypted-attribute-type.test.ts`
   - `pnpm vitest run packages/activerecord/src/encryption/encryptable-record.test.ts`
   - `pnpm vitest run packages/activerecord/src/encryption/encryptable-record-api.test.ts`
   - `pnpm vitest run packages/activerecord/src/encryption/null-encryptor.test.ts encrypting-only-encryptor.test.ts read-only-null-encryptor.test.ts`
   - `pnpm vitest run packages/activerecord/src/encryption/encrypted-fixtures.test.ts encryption-schemes.test.ts unencrypted-attributes.test.ts`
2. **Regression focus** (Change B/C touch the shared read/write path): the whole
   `encryption/` folder + `encryption.test.ts` + `encryption-hooks.test.ts`. CI
   runs the full suite; locally run the encryption files as a group.
3. **Target test:** `pnpm vitest run packages/activerecord/src/encryption/contexts.test.ts` green.
4. **Lint:** `npx eslint packages/activerecord/src/encryption/contexts.test.ts`
   → 0 `blazetrails/test-fixture-parity` errors.
5. **Remove** `"packages/activerecord/src/encryption/contexts.test.ts"` from
   `eslint/test-fixture-parity-exclude.json` (final commit).
6. `pnpm api:compare --package activerecord` (the new `Configurable.encryptor`
   getter and any `@internal` JSDoc the lint rule wants).

## 5. Risks / open questions

- **PR size.** Changes A–F are implementation; the test rewrite + exclude removal
  is separate. Likely two PRs (siblings off `main`, non-overlapping files per
  CLAUDE.md's 500-LOC ceiling): (1) context/encryptor model + behaviors;
  (2) `contexts.test.ts` rewrite + exclude-list removal. PR 2 depends on PR 1
  merging first (it asserts behavior PR 1 ships) — ship sequentially, do **not**
  stack.
- **`isEncrypted` under a swapped context.** Rails' `encrypted?` also reads the
  context encryptor; under `NullEncryptor` it returns `false`. Decide whether
  `EncryptedAttributeType.isEncrypted` (line ~128, currently
  `scheme.withContext(() => this._encryptor.isEncrypted(...))`) should switch to
  the context encryptor. Switching is Rails-faithful but can ripple into
  `support_unencrypted_data` detection and `EncryptableRecord.isEncryptedAttribute`
  — verify `encrypted-fixtures.test.ts` and `unencrypted-attributes.test.ts`
  before changing. Recommendation: leave `isEncrypted` on the scheme encryptor
  unless a test demands otherwise, and note the divergence.
- **`update` vs `update!` semantics.** Confirm the throwing update path raises
  `RecordInvalid` when a `validate` callback adds an error (Change D); if only
  `save!`/`create!` throw, the ported test must use the bang form.
