export type DeprecationBehavior = "raise" | "warn" | "stderr" | "log" | "silence" | "notify" | "report";

export class DeprecationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeprecationError";
  }
}

export class Deprecation {
  behavior: DeprecationBehavior | DeprecationBehavior[] | ((...args: unknown[]) => void) | null = "stderr";
  silenced = false;
  gem?: string;
  horizon?: string;
  disallowedWarnings: string[] | RegExp[] | ":all"[] | "all" = [];
  disallowedBehavior: DeprecationBehavior | ((...args: unknown[]) => void) | null = "raise";

  private _silencedForThread = false;

  constructor(options?: { horizon?: string; gem?: string; silenced?: boolean }) {
    this.horizon = options?.horizon;
    this.gem = options?.gem;
    if (options?.silenced != null) this.silenced = options.silenced;
  }

  warn(message?: string, _callstack?: unknown[]): void {
    if (this.silenced || this._silencedForThread) return;

    const msg = message ?? "DEPRECATION WARNING";
    const fullMessage = `DEPRECATION WARNING: ${msg}`;

    const behaviors = Array.isArray(this.behavior) ? this.behavior : [this.behavior];

    for (const b of behaviors) {
      if (b == null) continue;
      if (typeof b === "function") {
        b(fullMessage, _callstack ?? [], this);
        continue;
      }
      switch (b) {
        case "raise":
          throw new DeprecationError(msg);
        case "warn":
        case "stderr":
          process.stderr.write(fullMessage + "\n");
          break;
        case "log":
          // Would use Rails.logger in a real implementation
          process.stderr.write(fullMessage + "\n");
          break;
        case "silence":
          break;
        case "notify":
          break;
        case "report":
          break;
      }
    }
  }

  silence<T>(fn: () => T): T {
    const prev = this._silencedForThread;
    this._silencedForThread = true;
    try {
      return fn();
    } finally {
      this._silencedForThread = prev;
    }
  }

  deprecateMethod(target: object, methodName: string, message: string): void {
    const self = this;
    const original = (target as Record<string, unknown>)[methodName];
    if (typeof original !== "function") return;
    (target as Record<string, unknown>)[methodName] = function (...args: unknown[]) {
      self.warn(message);
      return (original as (...a: unknown[]) => unknown).apply(this, args);
    };
  }
}

export const deprecator = new Deprecation();
