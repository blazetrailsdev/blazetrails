/**
 * Trilogy adapter — connection adapter for MySQL databases via Trilogy.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::TrilogyAdapter
 *
 * Trilogy is GitHub's MySQL-compatible client library. The TrilogyAdapter
 * extends AbstractMysqlAdapter with Trilogy-specific connection handling,
 * similar to how Mysql2Adapter extends it with mysql2-specific handling.
 */

import { AbstractMysqlAdapter } from "./abstract-mysql-adapter.js";
import { DatabaseConnectionError, NoDatabaseError, ConnectionNotEstablished } from "../errors.js";

const SSL_MODES: Record<string, number> = {
  SSL_MODE_DISABLED: 0,
  SSL_MODE_PREFERRED: 1,
  SSL_MODE_REQUIRED: 2,
  SSL_MODE_VERIFY_CA: 3,
  SSL_MODE_VERIFY_IDENTITY: 4,
};

export class TrilogyAdapter extends AbstractMysqlAdapter {
  override get adapterName(): string {
    return "Trilogy";
  }

  constructor(config: Record<string, unknown> = {}) {
    super();
    void config;
  }

  static newClient(config: Record<string, unknown>): never {
    void config;
    throw new Error("TrilogyAdapter: no Trilogy JS driver available. Use Mysql2Adapter instead.");
  }

  static parseSslMode(mode: number | string): number {
    if (typeof mode === "number") return mode;
    let m = mode.toUpperCase();
    if (!m.startsWith("SSL_MODE_")) m = `SSL_MODE_${m}`;
    return SSL_MODES[m] ?? (mode as unknown as number);
  }

  static translateConnectError(
    config: Record<string, unknown>,
    error: { message: string; errorCode?: number },
  ): Error {
    const code = error.errorCode;
    if (code === 1044 || code === 1049) {
      return new NoDatabaseError(`No database: ${config.database}`);
    }
    if (code === 1045) {
      return new DatabaseConnectionError(`Access denied for user: ${config.username}`);
    }
    if (error.message.includes("TRILOGY_DNS_ERROR")) {
      return new DatabaseConnectionError(`Unknown host: ${config.host}`);
    }
    return new ConnectionNotEstablished(error.message);
  }
}
