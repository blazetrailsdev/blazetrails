/**
 * Ruby-style `include` for mixing module methods into a class.
 *
 * In Ruby, `include SomeModule` copies the module's instance methods
 * onto the including class's method lookup chain. This function does
 * the TypeScript equivalent: assigns each method from the module object
 * onto `klass.prototype`.
 *
 * Mirrors: Ruby's Module#include (core language feature)
 *
 * Usage:
 *   // Define a module as a plain object of this-typed functions
 *   const QueryMethods = {
 *     whereBang(this: Relation, opts: any) { ... },
 *     orderBang(this: Relation, ...args: any[]) { ... },
 *   };
 *
 *   // Include one or more modules into a class
 *   include(Relation, QueryMethods, FinderMethods);
 */

type AnyClass = new (...args: any[]) => any;
type Module = Record<string, Function>;

export function include(klass: AnyClass, ...modules: Module[]): void {
  const descriptors: PropertyDescriptorMap = {};
  for (const mod of modules) {
    for (const key of Object.keys(mod)) {
      descriptors[key] = {
        value: mod[key],
        writable: true,
        configurable: true,
        enumerable: false,
      };
    }
  }
  Object.defineProperties(klass.prototype, descriptors);
}
