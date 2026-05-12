---
name: ENC-2 encryptor privates complete
description: ENC-2 merged in PR #1278; encryptor.ts at 20/20 (100%); key infrastructure added
type: project
---

PR #1278 merged. encryptor.ts 7/20 → 20/20 (100%).

Key infrastructure added beyond the 13 private methods:

- `encoding-helpers.ts` — shared `normalizeEncoding`/`replaceUnencodable` used by both Encryptor and EncryptedAttributeType
- `default-key-provider-cache.ts` — module-level PBKDF2 cache keyed by (primaryKey, salt, digest), single `onConfigure` invalidation hook; imported by both Scheme and Encryptor (breaks scheme↔encryptor circular import)

**Why:** ENC-3 (encrypted-attribute-type.ts) and ENC-4 (encryptable-record.ts) are next.

**Known follow-ups documented in PR body:**

- `decrypt()` mutual-exclusion guard uses truthiness not `!= null` for keyProvider; throws `DecryptionError` instead of `ConfigError`
- `EncryptedAttributeType._applyForcedEncoding` duplicates `forceEncodingIfNeeded` (idempotent, fix in ENC-3)
