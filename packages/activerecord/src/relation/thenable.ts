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
 * Temporarily shadow `.then` on a specific instance so that `yield` in an
 * async generator or `resolve()` in a Promise does not unwrap it.
 *
 * Async generators call `Await` on yielded values, which resolves
 * thenables. This prevents that for objects that should be yielded/resolved
 * as-is (e.g., Relation instances from inBatches, load, presence).
 *
 * The shadow is removed via queueMicrotask so the instance regains
 * awaitability after it has safely crossed the async boundary.
 */
export function stripThenable<T extends object>(obj: T): T {
  const sentinel = {};
  Object.defineProperty(obj, "then", {
    value: sentinel,
    writable: true,
    configurable: true,
  });
  queueMicrotask(() => {
    // Only restore if the property is still our sentinel
    const desc = Object.getOwnPropertyDescriptor(obj, "then");
    if (desc && desc.value === sentinel) {
      delete (obj as any).then;
    }
  });
  return obj;
}

export function applyThenable(prototype: object, evaluationMethod: string = "toArray"): void {
  if (typeof (prototype as any)[evaluationMethod] !== "function") {
    const name = (prototype as any).constructor?.name ?? "unknown";
    throw new Error(`applyThenable: ${name}.prototype.${evaluationMethod} is not a function`);
  }

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
