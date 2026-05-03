/**
 * PostgreSQL jsonb type — binary JSON storage.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::PostgreSQL::OID::Jsonb.
 * Rails: `class Jsonb < Type::Json`. Only overrides `type` to return :jsonb.
 */

import { Json } from "../../../type/json.js";

export class Jsonb extends Json {
  override readonly name: string = "jsonb";

  override type(): string {
    return "jsonb";
  }
}
