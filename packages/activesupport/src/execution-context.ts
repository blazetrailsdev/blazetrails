/**
 * ExecutionContext — per-request key/value store.
 * Mirrors ActiveSupport::ExecutionContext.
 *
 * Note: This uses a process-global Map. In production with concurrent async
 * requests, consider integrating with AsyncLocalStorage for isolation.
 * Rails itself resets ExecutionContext via executor hooks per request.
 */
const _store = new Map<string, unknown>();

function saveAndApply(
  attrs: Record<string, unknown>,
): Map<string, { hadKey: boolean; value: unknown }> {
  const saved = new Map<string, { hadKey: boolean; value: unknown }>();
  for (const key of Object.keys(attrs)) {
    saved.set(key, { hadKey: _store.has(key), value: _store.get(key) });
    _store.set(key, attrs[key]);
  }
  return saved;
}

function restore(saved: Map<string, { hadKey: boolean; value: unknown }>): void {
  for (const [key, entry] of saved) {
    if (entry.hadKey) {
      _store.set(key, entry.value);
    } else {
      _store.delete(key);
    }
  }
}

export const ExecutionContext = {
  set(attrs: Record<string, unknown>, fn?: () => void | Promise<void>): void | Promise<void> {
    if (fn) {
      const saved = saveAndApply(attrs);
      let result: void | Promise<void>;
      try {
        result = fn();
      } catch (e) {
        restore(saved);
        throw e;
      }
      if (result && typeof (result as Promise<void>).then === "function") {
        return (result as Promise<void>).then(
          () => restore(saved),
          (e) => {
            restore(saved);
            throw e;
          },
        );
      }
      restore(saved);
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
