/**
 * ExecutionContext — per-request key/value store.
 * Mirrors ActiveSupport::ExecutionContext.
 *
 * Note: This uses a process-global Map. In production with concurrent async
 * requests, consider integrating with AsyncLocalStorage for isolation.
 * Rails itself resets ExecutionContext via executor hooks per request.
 */
const _store = new Map<string, unknown>();

export const ExecutionContext = {
  set(attrs: Record<string, unknown>, fn?: () => void): void {
    if (fn) {
      const saved = new Map<string, unknown>();
      for (const key of Object.keys(attrs)) {
        saved.set(key, _store.has(key) ? _store.get(key) : undefined);
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
