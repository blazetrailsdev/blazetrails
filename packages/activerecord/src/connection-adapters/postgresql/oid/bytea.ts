/**
 * PostgreSQL bytea type — binary data.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::PostgreSQL::OID::Bytea.
 *
 * Rails: `class Bytea < Type::Binary`. Only overrides deserialize, relying
 * on Type::Binary for cast/serialize/isChangedInPlace.
 */

import { BinaryType, BinaryData } from "@blazetrails/activemodel";

export class Bytea extends BinaryType {
  /**
   * Rails' OID::Bytea#deserialize:
   *   return if value.nil?
   *   return value.to_s if value.is_a?(Type::Binary::Data)
   *   PG::Connection.unescape_bytea(super)
   *
   * PG's unescape_bytea handles hex (`\x...`) and legacy octal escapes.
   * We delegate hex decoding locally and fall back to the parent for raw
   * bytes / Data instances.
   */
  override deserialize(value: unknown): Uint8Array | null {
    if (value == null) return null;
    if (value instanceof BinaryData) return value.bytes;
    if (typeof value === "string" && value.startsWith("\\x")) {
      const hex = value.slice(2);
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      }
      return bytes;
    }
    return super.deserialize(value);
  }
}
