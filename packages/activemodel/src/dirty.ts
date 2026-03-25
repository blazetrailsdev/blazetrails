/**
 * Dirty tracking mixin — tracks attribute changes on a model.
 *
 * Mirrors: ActiveModel::Dirty
 */
export class DirtyTracker {
  private _originalAttributes: Map<string, unknown> = new Map();
  private _changedAttributes: Map<string, [unknown, unknown]> = new Map();
  private _previousChanges: Map<string, [unknown, unknown]> = new Map();

  /**
   * Take a snapshot of the current attributes as the "clean" state.
   * For AttributeSet, uses snapshotValues() which captures cast
   * values for all initialized attributes.
   */
  snapshot(attributes: Map<string, unknown> | { snapshotValues(): Map<string, unknown> }): void {
    if (attributes instanceof Map) {
      this._originalAttributes = new Map(attributes);
    } else {
      this._originalAttributes = attributes.snapshotValues();
    }
    this._changedAttributes.clear();
  }

  attributeWillChange(name: string, from: unknown, to: unknown): void {
    if (from === to) {
      this._changedAttributes.delete(name);
    } else {
      const original = this._originalAttributes.get(name);
      if (to === original) {
        this._changedAttributes.delete(name);
      } else {
        this._changedAttributes.set(name, [this._originalAttributes.get(name), to]);
      }
    }
  }

  get changed(): boolean {
    return this._changedAttributes.size > 0;
  }

  get changedAttributes(): string[] {
    return Array.from(this._changedAttributes.keys());
  }

  get changes(): Record<string, [unknown, unknown]> {
    const result: Record<string, [unknown, unknown]> = {};
    for (const [k, v] of this._changedAttributes) {
      result[k] = v;
    }
    return result;
  }

  attributeChanged(name: string): boolean {
    return this._changedAttributes.has(name);
  }

  attributeWas(name: string): unknown {
    const change = this._changedAttributes.get(name);
    return change ? change[0] : this._originalAttributes.get(name);
  }

  attributeChange(name: string): [unknown, unknown] | undefined {
    return this._changedAttributes.get(name);
  }

  changesApplied(
    currentAttributes: Map<string, unknown> | { snapshotValues(): Map<string, unknown> },
  ): void {
    this._previousChanges = new Map(this._changedAttributes);
    if (currentAttributes instanceof Map) {
      this._originalAttributes = new Map(currentAttributes);
    } else {
      this._originalAttributes = currentAttributes.snapshotValues();
    }
    this._changedAttributes.clear();
  }

  get previousChanges(): Record<string, [unknown, unknown]> {
    const result: Record<string, [unknown, unknown]> = {};
    for (const [k, v] of this._previousChanges) {
      result[k] = v;
    }
    return result;
  }

  clearChangesInformation(): void {
    this._changedAttributes.clear();
    this._previousChanges.clear();
  }

  clearAttributeChanges(attributes: string[]): void {
    for (const attr of attributes) {
      this._changedAttributes.delete(attr);
    }
  }

  restore(attributes: Map<string, unknown> | { set(name: string, value: unknown): void }): void {
    for (const [name] of this._changedAttributes) {
      const original = this._originalAttributes.get(name);
      if (attributes instanceof Map) {
        attributes.set(name, original);
      } else {
        attributes.set(name, original);
      }
    }
    this._changedAttributes.clear();
  }
}
