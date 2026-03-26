import { AttributeSet } from "./attribute-set/builder.js";

function cloneValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return new Date(value.getTime());
  if (Array.isArray(value)) return value.map(cloneValue);
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    result[k] = cloneValue(v);
  }
  return result;
}

/**
 * Tracks attribute mutations by comparing current Attribute state
 * against original values.
 *
 * Mirrors: ActiveModel::AttributeMutationTracker
 */
export class AttributeMutationTracker {
  protected attributes: AttributeSet;
  protected forcedChanges: Map<string, unknown> = new Map();

  constructor(attributes: AttributeSet) {
    this.attributes = attributes;
  }

  changedAttributeNames(): string[] {
    return this.attrNames().filter((name) => this.isChanged(name));
  }

  changedValues(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const name of this.attrNames()) {
      if (this.isChanged(name)) {
        result[name] = this.originalValue(name);
      }
    }
    return result;
  }

  changes(): Record<string, [unknown, unknown]> {
    const result: Record<string, [unknown, unknown]> = {};
    for (const name of this.attrNames()) {
      const change = this.changeToAttribute(name);
      if (change) result[name] = change;
    }
    return result;
  }

  changeToAttribute(name: string): [unknown, unknown] | undefined {
    if (this.isChanged(name)) {
      return [this.originalValue(name), this.attributes.fetchValue(name)];
    }
    return undefined;
  }

  anyChanges(): boolean {
    return this.attrNames().some((name) => this.isChanged(name));
  }

  isChanged(name: string, options?: { from?: unknown; to?: unknown }): boolean {
    if (!this.attributeChanged(name)) return false;
    if (options && "from" in options && this.originalValue(name) !== options.from) return false;
    if (options && "to" in options && this.attributes.fetchValue(name) !== options.to) return false;
    return true;
  }

  changedInPlace(name: string): boolean {
    return this.attributes.getAttribute(name).changedInPlace();
  }

  forgetChange(name: string): void {
    const attr = this.attributes.getAttribute(name);
    this.attributes.set(name, attr.forgettingAssignment());
    this.forcedChanges.delete(name);
  }

  originalValue(name: string): unknown {
    if (this.forcedChanges.has(name)) {
      return this.forcedChanges.get(name);
    }
    return this.attributes.getAttribute(name).originalValue;
  }

  forceChange(name: string): void {
    const value = this.attributes.fetchValue(name);
    this.forcedChanges.set(name, cloneValue(value));
  }

  private attrNames(): string[] {
    return this.attributes.keys();
  }

  private attributeChanged(name: string): boolean {
    return this.forcedChanges.has(name) || this.attributes.getAttribute(name).isChanged();
  }
}

/**
 * Tracks forced mutations only — used during persistence callbacks.
 *
 * Mirrors: ActiveModel::ForcedMutationTracker
 */
export class ForcedMutationTracker extends AttributeMutationTracker {
  private finalizedChanges: Record<string, [unknown, unknown]> | null = null;

  changedInPlace(_name: string): boolean {
    return false;
  }

  changeToAttribute(name: string): [unknown, unknown] | undefined {
    if (this.finalizedChanges && name in this.finalizedChanges) {
      return [...this.finalizedChanges[name]];
    }
    return super.changeToAttribute(name);
  }

  forgetChange(name: string): void {
    this.forcedChanges.delete(name);
  }

  originalValue(name: string): unknown {
    if (this.isChanged(name)) {
      return this.forcedChanges.get(name);
    }
    return this.attributes.fetchValue(name);
  }

  forceChange(name: string): void {
    if (!this.forcedChanges.has(name)) {
      const value = this.attributes.fetchValue(name);
      this.forcedChanges.set(name, value);
    }
  }

  finalizeChanges(): void {
    this.finalizedChanges = this.changes();
  }
}

/**
 * Null object pattern — always reports no changes.
 *
 * Mirrors: ActiveModel::NullMutationTracker
 */
export class NullMutationTracker {
  changedAttributeNames(): string[] {
    return [];
  }

  changedValues(): Record<string, unknown> {
    return {};
  }

  changes(): Record<string, [unknown, unknown]> {
    return {};
  }

  changeToAttribute(_name: string): undefined {
    return undefined;
  }

  anyChanges(): boolean {
    return false;
  }

  isChanged(_name: string): boolean {
    return false;
  }

  changedInPlace(_name: string): boolean {
    return false;
  }

  originalValue(_name: string): undefined {
    return undefined;
  }

  forceChange(_name: string): void {}
  forgetChange(_name: string): void {}
  finalizeChanges(): void {}
}
