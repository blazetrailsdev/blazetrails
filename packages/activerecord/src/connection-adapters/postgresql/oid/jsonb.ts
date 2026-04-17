/**
 * PostgreSQL jsonb type — binary JSON storage.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::PostgreSQL::OID::Jsonb.
 * Rails: `class Jsonb < Type::Json`. Only overrides `type` to return :jsonb.
 */

import { JsonType } from "@blazetrails/activemodel";

export class Jsonb extends JsonType {
  override type(): string {
    return "jsonb";
  }
}
