/**
 * Scoping module — manages current scope and scope registry.
 * Base delegates scoping operations to these classes.
 *
 * Mirrors: ActiveRecord::Scoping
 */
export class Scoping {
  static scopeFor(modelClass: any): any | null {
    return ScopeRegistry.currentScope(modelClass);
  }
}

/**
 * Per-model registry tracking the current scope (set via scoping {}).
 * Uses a WeakMap so model classes can be garbage collected.
 *
 * Mirrors: ActiveRecord::Scoping::ScopeRegistry
 */
export class ScopeRegistry {
  private static _currentScopes: WeakMap<object, any> = new WeakMap();
  private static _ignoreDefaultScope: WeakMap<object, any> = new WeakMap();
  private static _globalCurrentScope: WeakMap<object, any> = new WeakMap();

  private static _instance: ScopeRegistry | null = null;

  static instance(): ScopeRegistry {
    if (!this._instance) this._instance = new ScopeRegistry();
    return this._instance;
  }

  currentScope(modelClass: object, skipInherited = false): any | null {
    return ScopeRegistry.currentScope(modelClass, skipInherited);
  }

  setCurrentScope(modelClass: object, scope: any): void {
    ScopeRegistry.setCurrentScope(modelClass, scope);
  }

  ignoreDefaultScope(modelClass: object, skipInherited = false): any | null {
    return ScopeRegistry.ignoreDefaultScope(modelClass, skipInherited);
  }

  setIgnoreDefaultScope(modelClass: object, value: any): void {
    ScopeRegistry.setIgnoreDefaultScope(modelClass, value);
  }

  globalCurrentScope(modelClass: object, skipInherited = false): any | null {
    return ScopeRegistry.globalCurrentScope(modelClass, skipInherited);
  }

  setGlobalCurrentScope(modelClass: object, scope: any): void {
    ScopeRegistry.setGlobalCurrentScope(modelClass, scope);
  }

  static currentScope(modelClass: object, _skipInherited = false): any | null {
    return this._currentScopes.get(modelClass) ?? null;
  }

  static setCurrentScope(modelClass: object, scope: any): void {
    if (scope === null) {
      this._currentScopes.delete(modelClass);
    } else {
      this._currentScopes.set(modelClass, scope);
    }
  }

  static ignoreDefaultScope(modelClass: object, _skipInherited = false): any | null {
    return this._ignoreDefaultScope.get(modelClass) ?? null;
  }

  static setIgnoreDefaultScope(modelClass: object, value: any): void {
    if (value === null) {
      this._ignoreDefaultScope.delete(modelClass);
    } else {
      this._ignoreDefaultScope.set(modelClass, value);
    }
  }

  static globalCurrentScope(modelClass: object, _skipInherited = false): any | null {
    return this._globalCurrentScope.get(modelClass) ?? null;
  }

  static setGlobalCurrentScope(modelClass: object, scope: any): void {
    if (scope === null) {
      this._globalCurrentScope.delete(modelClass);
    } else {
      this._globalCurrentScope.set(modelClass, scope);
    }
  }
}

// ---------------------------------------------------------------------------
// Instance methods
// ---------------------------------------------------------------------------

interface ScopingHost {
  constructor: { scope_attributes?(): Record<string, unknown>; currentScope?: any };
  assignAttributes?(attrs: Record<string, unknown>): void;
}

export function populateWithCurrentScopeAttributes(this: ScopingHost): void {
  const klass = this.constructor as any;
  if (!klass.currentScope) return;
  const attrs = scopeAttributes.call(klass);
  if (attrs && Object.keys(attrs).length > 0 && this.assignAttributes) {
    this.assignAttributes(attrs);
  }
}

export function initializeInternalsCallback(this: ScopingHost): void {
  populateWithCurrentScopeAttributes.call(this);
}

// ---------------------------------------------------------------------------
// Class methods
// ---------------------------------------------------------------------------

interface ScopingClassHost {
  currentScope?: any;
  all?(): any;
}

export function scopeAttributes(this: ScopingClassHost): Record<string, unknown> {
  const all = this.all?.();
  return all?.scopeForCreate?.() ?? {};
}

export function isScopeAttributes(this: ScopingClassHost): boolean {
  return !!this.currentScope;
}

export function scopeRegistry(): typeof ScopeRegistry {
  return ScopeRegistry;
}
