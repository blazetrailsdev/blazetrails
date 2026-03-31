/**
 * ExecutionContext — per-request key/value store.
 * Mirrors ActiveSupport::ExecutionContext.
 */
const _store = new Map<string, unknown>();

export const ExecutionContext = {
  set(attrs: Record<string, unknown>, fn?: () => void): void {
    if (fn) {
      const saved = new Map<string, unknown>();
      for (const key of Object.keys(attrs)) {
        saved.set(key, _store.get(key));
        _store.set(key, attrs[key]);
      }
      try {
        fn();
      } finally {
        for (const [key, value] of saved) {
          if (value === undefined) {
            _store.delete(key);
          } else {
            _store.set(key, value);
          }
        }
      }
    } else {
      for (const key of Object.keys(attrs)) {
        _store.set(key, attrs[key]);
      }
    }
  },

  get(key: string): unknown {
    return _store.get(key);
  },

  setKey(key: string, value: unknown): void {
    _store.set(key, value);
  },

  toH(): Record<string, unknown> {
    return Object.fromEntries(_store);
  },

  clear(): void {
    _store.clear();
  },
};
