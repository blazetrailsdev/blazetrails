import {
  LogSubscriber as BaseLogSubscriber,
  NotificationEvent as Event,
  type Logger,
} from "@blazetrails/activesupport";

/**
 * ActiveRecord::LogSubscriber — logs SQL queries with coloring, timing,
 * and bind parameter display. Mirrors Rails' ActiveRecord::LogSubscriber.
 */
export class LogSubscriber extends BaseLogSubscriber {
  static readonly IGNORE_PAYLOAD_NAMES = ["SCHEMA", "EXPLAIN"];

  debugs: string[] = [];

  private static _verboseQueryLogs = false;

  static get verboseQueryLogs(): boolean {
    return this._verboseQueryLogs;
  }

  static set verboseQueryLogs(value: boolean) {
    this._verboseQueryLogs = value;
  }

  // -- Event handlers ------------------------------------------------------

  strictLoadingViolation(event: Event): void {
    this._debug(() => {
      const owner = event.payload.owner;
      const reflection = event.payload.reflection as any;
      return this.color(reflection.strictLoadingViolationMessage(owner), BaseLogSubscriber.RED);
    });
  }

  sql(event: Event): void {
    const payload = event.payload;

    if (LogSubscriber.IGNORE_PAYLOAD_NAMES.includes(payload.name as string)) return;

    let name: string;
    if (payload.async) {
      const lockWait = Number(payload.lock_wait ?? payload.lockWait ?? 0);
      name = `ASYNC ${payload.name ?? ""} (${lockWait.toFixed(1)}ms) (db time ${event.duration.toFixed(1)}ms)`;
    } else {
      name = `${payload.name ?? ""} (${event.duration.toFixed(1)}ms)`;
    }

    if (payload.cached) {
      name = `CACHE ${name}`;
    }

    const sql = payload.sql as string;
    let binds: string | null = null;

    if (payload.binds && Array.isArray(payload.binds) && payload.binds.length > 0) {
      const castedParams = this._typeCastedBinds(
        payload.type_casted_binds ?? payload.typeCastedBinds,
      );
      const bindPairs: [string | null, unknown][] = [];

      for (let i = 0; i < (payload.binds as any[]).length; i++) {
        const attr = (payload.binds as any[])[i];
        let attributeName: string | null = null;

        if (attr && typeof attr.name === "string") {
          attributeName = attr.name;
        } else if (Array.isArray(attr) && attr[i] && typeof attr[i].name === "string") {
          attributeName = attr[i].name;
        }

        const filteredParams = this._filter(attributeName, castedParams?.[i]);
        bindPairs.push(this._renderBind(attr, filteredParams));
      }

      binds = `  ${JSON.stringify(bindPairs)}`;
    }

    const colorizedName = this._colorizePayloadName(name, payload.name as string | undefined);
    const colorizedSql = this.colorizeLogging
      ? this.color(sql, this._sqlColor(sql), { bold: true })
      : sql;

    const message = `  ${colorizedName}  ${colorizedSql}${binds ?? ""}`;
    this._doDebug(message);
  }

  // -- Private helpers -----------------------------------------------------

  private _doDebug(message: string): boolean {
    this.debugs.push(message);
    const l = this.logger;
    if (!l) return false;
    const result = l.debug(message);

    if ((this.constructor as typeof LogSubscriber).verboseQueryLogs) {
      this._logQuerySource();
    }

    return result;
  }

  private _logQuerySource(): void {
    const source = this._querySourceLocation();
    if (source) {
      const l = this.logger;
      if (l) l.debug(`  ↳ ${source}`);
    }
  }

  protected _querySourceLocation(): string | null {
    try {
      const err = new Error();
      const stack = err.stack?.split("\n") ?? [];
      for (const line of stack.slice(2)) {
        const trimmed = line.trim();
        if (
          !trimmed.includes("log-subscriber") &&
          !trimmed.includes("LogSubscriber") &&
          !trimmed.includes("notifications") &&
          !trimmed.includes("node_modules")
        ) {
          return trimmed.replace(/^at\s+/, "");
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  private _typeCastedBinds(castedBinds: unknown): any[] {
    if (typeof castedBinds === "function") return castedBinds();
    return (castedBinds as any[]) ?? [];
  }

  private _renderBind(attr: any, value: unknown): [string | null, unknown] {
    // ActiveModel::Attribute — has type and value properties
    if (attr && typeof attr === "object" && "type" in attr && "value" in attr) {
      if (attr.type?.binary?.() && attr.value != null) {
        const bytes =
          typeof attr.valueForDatabase === "function"
            ? String(attr.valueForDatabase()).length
            : String(attr.value).length;
        value = `<${bytes} bytes of binary data>`;
      }
      return [attr.name ?? null, value];
    }

    if (Array.isArray(attr)) {
      return [attr[0]?.name ?? null, value];
    }

    // Simple object with .name (e.g. query attribute descriptor)
    if (attr && typeof attr === "object" && typeof attr.name === "string") {
      return [attr.name, value];
    }

    return [null, value];
  }

  private _colorizePayloadName(name: string, payloadName: string | undefined): string {
    if (!payloadName || payloadName === "" || payloadName === "SQL") {
      return this.color(name, BaseLogSubscriber.MAGENTA, { bold: true });
    }
    return this.color(name, BaseLogSubscriber.CYAN, { bold: true });
  }

  private _sqlColor(sql: string): string {
    if (/^\s*rollback/im.test(sql)) return BaseLogSubscriber.RED;
    if (/select .*for update/im.test(sql) || /^\s*lock/im.test(sql)) return BaseLogSubscriber.WHITE;
    if (/^\s*select/i.test(sql)) return BaseLogSubscriber.BLUE;
    if (/^\s*insert/i.test(sql)) return BaseLogSubscriber.GREEN;
    if (/^\s*update/i.test(sql)) return BaseLogSubscriber.YELLOW;
    if (/^\s*delete/i.test(sql)) return BaseLogSubscriber.RED;
    if (/transaction\s*$/i.test(sql)) return BaseLogSubscriber.CYAN;
    return BaseLogSubscriber.MAGENTA;
  }

  override get logger(): Logger | null {
    return (this.constructor as typeof LogSubscriber).logger;
  }

  private _filter(_name: string | null, value: unknown): unknown {
    return value;
  }
}
