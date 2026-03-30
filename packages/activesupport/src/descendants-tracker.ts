const _subclassMap = new globalThis.WeakMap<Function, Set<Function>>();
const _excludedDescendants = new globalThis.WeakSet<Function>();
let _clearDisabled = false;

export class WeakSet<T extends object> {
  private _map = new WeakMap<T, boolean>();
  private _refs: WeakRef<T>[] = [];

  add(object: T): void {
    if (!this._map.has(object)) {
      this._map.set(object, true);
      this._refs.push(new WeakRef(object));
    }
  }

  has(object: T): boolean {
    return this._map.has(object);
  }

  toArray(): T[] {
    const result: T[] = [];
    const alive: WeakRef<T>[] = [];
    for (const ref of this._refs) {
      const obj = ref.deref();
      if (obj !== undefined) {
        alive.push(ref);
        result.push(obj);
      }
    }
    this._refs = alive;
    return result;
  }
}

export interface ReloadedClassesFiltering {
  subclasses(): Function[];
  descendants(): Function[];
}

export namespace DescendantsTracker {
  export function registerSubclass(parent: Function, child: Function): void {
    if (!_subclassMap.has(parent)) _subclassMap.set(parent, new Set());
    _subclassMap.get(parent)!.add(child);
  }

  export function subclasses(klass: Function): Function[] {
    const subs = [...(_subclassMap.get(klass) ?? [])];
    return reject(subs);
  }

  export function descendants(klass: Function): Function[] {
    const subs = subclasses(klass);
    return [...subs, ...subs.flatMap((s) => descendants(s))];
  }

  export function disableClear(): void {
    _clearDisabled = true;
  }

  export function clear(classes: Function[]): void {
    if (_clearDisabled) {
      throw new Error(
        "DescendantsTracker.clear was disabled because config.enable_reloading is false",
      );
    }
    for (const klass of classes) {
      _excludedDescendants.add(klass);
      for (const descendant of descendants(klass)) {
        _excludedDescendants.add(descendant);
      }
    }
  }

  export function reject(classes: Function[]): Function[] {
    return classes.filter((d) => !_excludedDescendants.has(d));
  }
}

export { DescendantsTracker as default };
