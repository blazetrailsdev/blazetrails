import { Base } from "../base.js";
import { Relation } from "../relation.js";
import { Configurable } from "./configurable.js";
import { EncryptedAttributeType } from "./encrypted-attribute-type.js";
import { ExtendedDeterministicQueries } from "./extended-deterministic-queries.js";

/**
 * Boot-time entrypoint. Installs the deterministic-encryption query
 * patches against the real `Relation`, `Base`, and `EncryptedAttributeType`
 * classes if `Configurable.config.extendQueries` is true.
 *
 * Mirrors: the Rails railtie that calls
 * `ActiveRecord::Encryption::ExtendedDeterministicQueries.install_support`
 * when `config.active_record.encryption.extend_queries` is set.
 *
 * Safe to call multiple times — `installSupport` is idempotent. Returns
 * `true` when the patches are active after the call, `false` when
 * `extendQueries` is disabled and nothing was installed.
 */
export function installExtendedQueriesIfConfigured(): boolean {
  if (!Configurable.config.extendQueries) return false;
  ExtendedDeterministicQueries.installSupport({
    Relation: Relation as unknown as { prototype: Record<string, Function> },
    Base: Base as unknown as Record<string, Function>,
    EncryptedAttributeType: EncryptedAttributeType as unknown as {
      prototype: Record<string, Function>;
    },
  });
  return ExtendedDeterministicQueries.installed;
}
