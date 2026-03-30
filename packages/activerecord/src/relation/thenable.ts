/**
 * Thenable mixin — makes lazy query objects directly awaitable.
 *
 * Adds `.then()`, `.catch()`, and `.finally()` to a prototype,
 * delegating to the specified evaluation method. This implements
 * the PromiseLike protocol so `await relation` triggers evaluation.
 *
 * Mirrors how Rails relations implicitly evaluate when iterated.
 */

/**
 * Shadow `.then` on a specific instance so that `yield` in an async
 * generator or `resolve()` in a Promise does not unwrap it.
 *
 * Async generators call `Await` on yielded values, which resolves
 * thenables. This prevents that for objects that should be yielded/resolved
 * as-is (e.g., Relation instances from inBatches, load, presence).
 *
 * The shadow is permanent for the instance — the prototype `.then` remains
 * available on fresh clones. Use this only on instances that are being
 * returned as "self" from methods like load/reload/presence.
 */
export function stripThenable<T extends object>(obj: T): T {
  Object.defineProperty(obj, "then", {
    value: undefined,
    writable: true,
    configurable: true,
  });
  return obj;
}

export function applyThenable(prototype: object, evaluationMethod: string = "toArray"): void {
  const def = { writable: true, configurable: true, enumerable: false };

  Object.defineProperties(prototype, {
    then: {
      ...def,
      value(
        this: any,
        onfulfilled?: ((value: any) => any) | null,
        onrejected?: ((reason: any) => any) | null,
      ) {
        return this[evaluationMethod]().then(onfulfilled, onrejected);
      },
    },
    catch: {
      ...def,
      value(this: any, onrejected?: ((reason: any) => any) | null) {
        return this[evaluationMethod]().catch(onrejected);
      },
    },
    finally: {
      ...def,
      value(this: any, onfinally?: (() => void) | null) {
        return this[evaluationMethod]().finally(onfinally);
      },
    },
  });
}
