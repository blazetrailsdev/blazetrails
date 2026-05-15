export class TestSession {
  private _data = new Map<string, unknown>();

  get(key: string): unknown {
    return this._data.get(key);
  }

  set(key: string, value: unknown): void {
    this._data.set(key, value);
  }

  has(key: string): boolean {
    return this._data.has(key);
  }

  delete(key: string): void {
    this._data.delete(key);
  }

  clear(): void {
    this._data.clear();
  }

  toHash(): Record<string, unknown> {
    return Object.fromEntries(this._data);
  }

  toH(): Record<string, unknown> {
    return this.toHash();
  }

  toObject(): Record<string, unknown> {
    return this.toHash();
  }
}
